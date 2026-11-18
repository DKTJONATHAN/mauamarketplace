import {
  type Env,
  type DbPayment,
  json,
  normalizePhone,
  db,
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
