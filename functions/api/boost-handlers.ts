import {
  type Env,
  type DbPayment,
  UUID_RE,
  json,
  normalizePhone,
  db,
  requireUser,
  darajaToken,
  nairobiTimestamp,
  apiBase,
} from './boost-shared';
import { assignFairAdSchedule } from './ad-schedule';

function callbackValue(items: { Name?: string; Value?: string | number }[] | undefined, name: string): string | number | null {
  const value = items?.find(item => item.Name === name)?.Value;
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const callbackToken = new URL(request.url).searchParams.get('k');
  if (!env.MPESA_CALLBACK_TOKEN || callbackToken !== env.MPESA_CALLBACK_TOKEN) {
    return json({ ResultCode: 1, ResultDesc: 'Not allowed.' }, 403);
  }
  const body = await request.json() as {
    Body?: { stkCallback?: {
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: { Name?: string; Value?: string | number }[] };
    } };
  };
  const callback = body.Body?.stkCallback;
  if (!callback?.CheckoutRequestID || typeof callback.ResultCode !== 'number') {
    return json({ ResultCode: 1, ResultDesc: 'Invalid callback payload.' }, 400);
  }

  const rows = await db<DbPayment[]>(
    env,
    `listing_boost_payments?select=id,user_id,listing_id,phone,amount,status,checkout_request_id&checkout_request_id=eq.${encodeURIComponent(callback.CheckoutRequestID)}&limit=1`,
  );
  const payment = rows[0];
  const items = callback.CallbackMetadata?.Item;
  const amount = callbackValue(items, 'Amount');
  const receipt = callbackValue(items, 'MpesaReceiptNumber');
  const paidPhone = normalizePhone(String(callbackValue(items, 'PhoneNumber') ?? ''));
  const validAmount = typeof amount === 'number' ? amount : Number(amount);

  if (!payment) {
    const adRows = await db<{
      id: string; user_id: string; contact_phone: string; amount_kes: number;
      payment_status: string; checkout_request_id: string; business_name: string;
      website_url: string | null; creative_url: string | null; placement: string;
      start_date: string; duration_days: number; notes: string | null;
    }[]>(env, `advertising_requests?select=id,user_id,contact_phone,amount_kes,payment_status,checkout_request_id,business_name,website_url,creative_url,placement,start_date,duration_days,notes&checkout_request_id=eq.${encodeURIComponent(callback.CheckoutRequestID)}&limit=1`);
    const booking = adRows[0];
    if (!booking) return json({ ResultCode: 1, ResultDesc: 'Payment reference not found.' }, 404);
    if (booking.payment_status === 'paid') return json({ ResultCode: 0, ResultDesc: 'Already confirmed.' });
    if (callback.ResultCode === 0) {
      if (typeof receipt !== 'string' || receipt.length < 6 ||
        validAmount !== booking.amount_kes || paidPhone !== normalizePhone(booking.contact_phone)) {
        return json({ ResultCode: 1, ResultDesc: 'Advertising payment details could not be verified.' }, 409);
      }
      const occupied = await db<{ start_date: string; end_date: string }[]>(
        env,
        `advertisements?select=start_date,end_date&placement=eq.${encodeURIComponent(booking.placement)}&status=in.(pending_review,active)&order=start_date.asc`,
      ).catch(() => [] as { start_date: string; end_date: string }[]);
      const schedule = assignFairAdSchedule({
        placement: booking.placement,
        preferredStart: booking.start_date,
        durationDays: booking.duration_days,
        existing: occupied,
      });
      await db(env, 'advertisements?on_conflict=request_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({
          request_id: booking.id,
          business_name: booking.business_name,
          headline: booking.business_name,
          body: booking.notes,
          website_url: booking.website_url,
          creative_url: booking.creative_url,
          placement: booking.placement,
          start_date: schedule.startDate,
          end_date: schedule.endDate,
          status: 'pending_review',
        }),
      });
      if (schedule.delayed) {
        await db(env, `advertising_requests?id=eq.${encodeURIComponent(booking.id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            start_date: schedule.startDate,
            notes: `${booking.notes ? `${booking.notes}\n\n` : ''}[System] Preferred start was fully booked. Queued to start ${schedule.startDate}.`.slice(0, 1000),
          }),
        }).catch(() => {});
      }
      await db(env, `advertising_requests?id=eq.${encodeURIComponent(booking.id)}&checkout_request_id=eq.${encodeURIComponent(callback.CheckoutRequestID)}&payment_status=eq.pending`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          payment_status: 'paid', status: 'paid', mpesa_receipt_number: receipt,
          payment_result_code: 0, payment_description: callback.ResultDesc ?? 'Payment confirmed',
          paid_at: new Date().toISOString(),
        }),
      });
      return json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    await db(env, `advertising_requests?id=eq.${encodeURIComponent(booking.id)}&payment_status=eq.pending`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        payment_status: 'failed', payment_result_code: callback.ResultCode,
        payment_description: (callback.ResultDesc ?? 'Payment was not completed').slice(0, 500),
      }),
    });
    return json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  if (payment.status === 'paid') return json({ ResultCode: 0, ResultDesc: 'Already confirmed.' });
  if (callback.ResultCode === 0) {
    if (typeof receipt !== 'string' || receipt.length < 6 || validAmount !== payment.amount || paidPhone !== payment.phone) {
      return json({ ResultCode: 1, ResultDesc: 'Payment details could not be verified.' }, 409);
    }
    const featuredUntil = new Date(Date.now() + 30 * 86400000).toISOString();
    await db(env, `listings?id=eq.${encodeURIComponent(payment.listing_id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ featured_until: featuredUntil }),
    });
    await db(env, `listing_boost_payments?id=eq.${encodeURIComponent(payment.id)}&checkout_request_id=eq.${encodeURIComponent(callback.CheckoutRequestID)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'paid',
        result_code: 0,
        result_description: callback.ResultDesc ?? 'Payment confirmed',
        mpesa_receipt_number: receipt,
        paid_at: new Date().toISOString(),
      }),
    });
    return json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  await db(env, `listing_boost_payments?id=eq.${encodeURIComponent(payment.id)}&status=in.(initiating,pending)`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'failed',
      result_code: callback.ResultCode,
      result_description: (callback.ResultDesc ?? 'Payment was not completed').slice(0, 500),
    }),
  });
  return json({ ResultCode: 0, ResultDesc: 'Accepted' });
}

export async function queryDarajaPayment(env: Env, user: { id: string }, paymentId: unknown): Promise<Response> {
  if (typeof paymentId !== 'string' || !UUID_RE.test(paymentId)) return json({ error: 'Invalid payment reference.' }, 400);
  if (!env.MPESA_SHORTCODE || !env.MPESA_PASSKEY) return json({ error: 'M-PESA query credentials are not configured.' }, 503);
  const rows = await db<{ id: string; user_id: string; checkout_request_id: string | null; status: string }[]>(
    env, `listing_boost_payments?select=id,user_id,checkout_request_id,status&id=eq.${encodeURIComponent(paymentId)}&limit=1`,
  );
  const payment = rows[0];
  if (!payment || payment.user_id !== user.id) return json({ error: 'Payment not found.' }, 404);
  if (payment.status === 'paid') return json({ responseCode: '0', responseDescription: 'Payment confirmed.', resultCode: 0, resultDescription: 'Paid' });
  if (!payment.checkout_request_id || !['pending', 'failed'].includes(payment.status)) {
    return json({ responseCode: null, responseDescription: 'No pending M-PESA request to check.', resultCode: null, resultDescription: null });
  }
  const token = await darajaToken(env);
  const timestamp = nairobiTimestamp();
  const password = btoa(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`);
  const response = await fetch(`${apiBase(env)}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ BusinessShortCode: env.MPESA_SHORTCODE, Password: password, Timestamp: timestamp, CheckoutRequestID: payment.checkout_request_id }),
  });
  const result = await response.json().catch(() => ({})) as { ResponseCode?: string; ResponseDescription?: string; ResultCode?: string | number; ResultDesc?: string };
  return json({ responseCode: result.ResponseCode ?? null, responseDescription: result.ResponseDescription ?? null, resultCode: result.ResultCode ?? null, resultDescription: result.ResultDesc ?? null });
}

export async function paymentStatus(request: Request, env: Env, user: { id: string }): Promise<Response> {
  const paymentId = new URL(request.url).searchParams.get('paymentId');
  if (!paymentId || !UUID_RE.test(paymentId)) return json({ error: 'Invalid payment reference.' }, 400);
  const rows = await db<{ id: string; user_id: string; status: string; result_code: number | null; result_description: string | null; paid_at: string | null }[]>(
    env, `listing_boost_payments?select=id,user_id,status,result_code,result_description,paid_at&id=eq.${encodeURIComponent(paymentId)}&limit=1`,
  );
  const payment = rows[0];
  if (!payment || payment.user_id !== user.id) return json({ error: 'Payment not found.' }, 404);
  return json({
    status: payment.status,
    resultCode: payment.result_code,
    message: payment.status === 'paid' ? 'Payment confirmed. Your listing is now Featured.' :
      payment.status === 'failed' ? (payment.result_description || 'Payment was not completed.') :
      'Waiting for Safaricom to confirm your payment.',
    paidAt: payment.paid_at,
  });
}

export async function queryAdvertisingPayment(env: Env, user: { id: string }, requestId: unknown): Promise<Response> {
  if (typeof requestId !== 'string' || !UUID_RE.test(requestId)) return json({ error: 'Invalid advertising request.' }, 400);
  if (!env.MPESA_SHORTCODE || !env.MPESA_PASSKEY) return json({ error: 'M-PESA query credentials are not configured.' }, 503);
  const rows = await db<{ id: string; user_id: string; checkout_request_id: string | null; payment_status: string }[]>(
    env, `advertising_requests?select=id,user_id,checkout_request_id,payment_status&id=eq.${encodeURIComponent(requestId)}&limit=1`,
  );
  const booking = rows[0];
  if (!booking || booking.user_id !== user.id) return json({ error: 'Advertising request not found.' }, 404);
  if (booking.payment_status === 'paid') return json({ status: 'paid', resultCode: 0, resultDescription: 'Payment confirmed.' });
  if (!booking.checkout_request_id || booking.payment_status !== 'pending') {
    return json({ status: booking.payment_status, resultCode: null, resultDescription: 'No pending M-PESA request to check.' });
  }
  const token = await darajaToken(env);
  const timestamp = nairobiTimestamp();
  const password = btoa(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`);
  const response = await fetch(`${apiBase(env)}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ BusinessShortCode: env.MPESA_SHORTCODE, Password: password, Timestamp: timestamp, CheckoutRequestID: booking.checkout_request_id }),
  });
  const result = await response.json().catch(() => ({})) as { ResponseCode?: string; ResponseDescription?: string; ResultCode?: string | number; ResultDesc?: string };
  return json({ status: booking.payment_status, resultCode: result.ResultCode ?? null, resultDescription: result.ResultDesc ?? result.ResponseDescription ?? null });
}

export async function advertisingPaymentStatus(request: Request, env: Env, user: { id: string }): Promise<Response> {
  const requestId = new URL(request.url).searchParams.get('advertisingRequestId');
  if (!requestId || !UUID_RE.test(requestId)) return json({ error: 'Invalid advertising request.' }, 400);
  const rows = await db<{ id: string; user_id: string; payment_status: string; payment_result_code: number | null; payment_description: string | null; paid_at: string | null }[]>(
    env, `advertising_requests?select=id,user_id,payment_status,payment_result_code,payment_description,paid_at&id=eq.${encodeURIComponent(requestId)}&limit=1`,
  );
  const booking = rows[0];
  if (!booking || booking.user_id !== user.id) return json({ error: 'Advertising request not found.' }, 404);
  return json({
    status: booking.payment_status,
    resultCode: booking.payment_result_code,
    message: booking.payment_description || (booking.payment_status === 'paid' ? 'Payment confirmed.' : 'Waiting for M-PESA confirmation.'),
    paidAt: booking.paid_at,
  });
}

export async function latestPaymentForListing(request: Request, env: Env, user: { id: string }): Promise<Response> {
  const listingId = new URL(request.url).searchParams.get('listingId');
  if (!listingId || !UUID_RE.test(listingId)) return json({ error: 'Invalid listing reference.' }, 400);
  const rows = await db<{ id: string; status: string; result_description: string | null; paid_at: string | null }[]>(
    env,
    `listing_boost_payments?select=id,status,result_description,paid_at&user_id=eq.${encodeURIComponent(user.id)}&listing_id=eq.${encodeURIComponent(listingId)}&order=created_at.desc&limit=1`,
  );
  const payment = rows[0];
  if (!payment || !['pending', 'failed'].includes(payment.status)) return json({ paymentId: null });
  return json({
    paymentId: payment.id,
    status: payment.status,
    message: payment.status === 'failed' ? (payment.result_description || 'Payment was not completed.') : 'Waiting for Safaricom to confirm your payment.',
    paidAt: payment.paid_at,
  });
}
