import {
  type Env,
  PRICE_KES,
  UUID_RE,
  json,
  normalizePhone,
  db,
  darajaToken,
  markInitiationFailed,
  nairobiTimestamp,
  apiBase,
} from './boost-shared';

export async function initiate(request: Request, env: Env, user: { id: string }): Promise<Response> {
  const body = await request.json() as { listingId?: unknown; phone?: unknown };
  if (typeof body.listingId !== 'string' || !UUID_RE.test(body.listingId)) {
    return json({ error: 'Choose a valid listing to promote.' }, 400);
  }
  const phone = normalizePhone(body.phone);
  if (!phone) return json({ error: 'Enter a valid Kenyan M-PESA number, for example 0712345678.' }, 400);

  if (!['sandbox', 'production'].includes(env.MPESA_ENVIRONMENT?.toLowerCase() || '')) {
    return json({ error: 'Set MPESA_ENVIRONMENT to sandbox or production before accepting payments.' }, 503);
  }
  if (!env.MPESA_SHORTCODE || !env.MPESA_PASSKEY || !env.MPESA_CALLBACK_URL || !env.MPESA_CALLBACK_TOKEN) {
    return json({ error: 'M-PESA payments are not configured yet. Please contact Maua Marketplace support.' }, 503);
  }
  try {
    const callback = new URL(env.MPESA_CALLBACK_URL);
    if (callback.protocol !== 'https:') return json({ error: 'The M-PESA callback URL must use HTTPS.' }, 503);
    if (callback.searchParams.get('k') !== env.MPESA_CALLBACK_TOKEN || env.MPESA_CALLBACK_TOKEN.length < 32) {
      return json({ error: 'The M-PESA callback URL must include the configured callback token.' }, 503);
    }
  } catch {
    return json({ error: 'The M-PESA callback URL is invalid.' }, 503);
  }

  const listings = await db<{ id: string; seller_id: string; status: string }[]>(
    env,
    `listings?select=id,seller_id,status&id=eq.${encodeURIComponent(body.listingId)}&limit=1`,
  );
  const listing = listings[0];
  if (!listing || listing.seller_id !== user.id) return json({ error: 'That listing was not found in your account.' }, 404);
  if (listing.status !== 'active') return json({ error: 'Only active listings can be promoted.' }, 409);

  const pending = await db<{ id: string }[]>(env,
    `listing_boost_payments?select=id&listing_id=eq.${encodeURIComponent(listing.id)}&status=in.(initiating,pending)&limit=1`,
  );
  if (pending.length) return json({ error: 'A payment request is already waiting for this listing. Complete it or wait for it to expire before trying again.' }, 409);

  const reference = `MAUA${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const created = await db<{ id: string }[]>(env, 'listing_boost_payments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: user.id,
      listing_id: listing.id,
      phone,
      amount: PRICE_KES,
      status: 'initiating',
      reference,
    }),
  });
  const paymentId = created[0]?.id;
  if (!paymentId) throw new Error('Could not create the payment record.');

  try {
    const token = await darajaToken(env);
    const timestamp = nairobiTimestamp();
    const password = btoa(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`);
    const isPayBill = env.MPESA_TRANSACTION_TYPE === 'CustomerPayBillOnline';
    if (!isPayBill && !env.MPESA_TILL_NUMBER) {
      await markInitiationFailed(env, paymentId, 'M-PESA Till number is not configured.');
      return json({ error: 'Configure the M-PESA Till number before accepting Buy Goods payments.' }, 503);
    }
    const transactionType = isPayBill ? 'CustomerPayBillOnline' : 'CustomerBuyGoodsOnline';
    const partyB = isPayBill ? env.MPESA_SHORTCODE : env.MPESA_TILL_NUMBER;

    const response = await fetch(`${apiBase(env)}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: transactionType,
        Amount: PRICE_KES,
        PartyA: phone,
        PartyB: partyB,
        PhoneNumber: phone,
        CallBackURL: env.MPESA_CALLBACK_URL,
        AccountReference: reference,
        TransactionDesc: 'MauaBoost',
      }),
    });
    const result = await response.json().catch(() => ({})) as {
      ResponseCode?: string;
      ResponseDescription?: string;
      CustomerMessage?: string;
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      errorMessage?: string;
      errorCode?: string;
      requestId?: string;
    };
    if (!response.ok || result.ResponseCode !== '0' || !result.CheckoutRequestID) {
      const reason = result.errorMessage || result.ResponseDescription || 'Safaricom did not accept the payment request.';
      const diagnostic = `Daraja STK Push rejected the request (HTTP ${response.status}${result.errorCode ? `, code ${result.errorCode}` : ''}): ${reason}`;
      await markInitiationFailed(env, paymentId, diagnostic);
      return json({ error: diagnostic }, 502);
    }

    await db(env, `listing_boost_payments?id=eq.${encodeURIComponent(paymentId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'pending',
        merchant_request_id: result.MerchantRequestID ?? null,
        checkout_request_id: result.CheckoutRequestID,
      }),
    });

    return json({
      paymentId,
      status: 'pending',
      message: result.CustomerMessage || 'Check your phone and approve the M-PESA payment prompt.',
    });
  } catch (error) {
    await markInitiationFailed(env, paymentId, error instanceof Error ? error.message : 'Payment request failed.').catch(() => {});
    throw error;
  }
}

export async function initiateAdvertising(request: Request, env: Env, user: { id: string }): Promise<Response> {
  const body = await request.json() as { requestId?: unknown; phone?: unknown };
  if (typeof body.requestId !== 'string' || !UUID_RE.test(body.requestId)) {
    return json({ error: 'Choose a valid advertising request.' }, 400);
  }
  const phone = normalizePhone(body.phone);
  if (!phone) return json({ error: 'Enter a valid Kenyan M-PESA number, for example 0712345678.' }, 400);

  const rows = await db<{
    id: string; user_id: string; amount_kes: number; payment_status: string;
    contact_phone: string; start_date: string;
  }[]>(env, `advertising_requests?select=id,user_id,amount_kes,payment_status,contact_phone,start_date&id=eq.${encodeURIComponent(body.requestId)}&limit=1`);
  const booking = rows[0];
  if (!booking || booking.user_id !== user.id) return json({ error: 'Advertising request not found.' }, 404);
  if (booking.payment_status === 'paid') return json({ error: 'This advertising request has already been paid.' }, 409);
  if (phone !== normalizePhone(booking.contact_phone)) return json({ error: 'Use the same M-PESA number entered in your advertising request.' }, 400);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
  if (booking.start_date < today) return json({ error: 'Choose today or a future date for your advertising campaign.' }, 400);
  if (booking.payment_status === 'pending') return json({ error: 'A payment prompt is already pending for this advertising request.' }, 409);

  if (!['sandbox', 'production'].includes(env.MPESA_ENVIRONMENT?.toLowerCase() || '')) {
    return json({ error: 'M-PESA payments are not configured. Please contact Maua Marketplace.' }, 503);
  }
  if (!env.MPESA_SHORTCODE || !env.MPESA_PASSKEY || !env.MPESA_CALLBACK_URL || !env.MPESA_CALLBACK_TOKEN) {
    return json({ error: 'M-PESA payments are not configured yet. Please contact Maua Marketplace support.' }, 503);
  }
  try {
    const callback = new URL(env.MPESA_CALLBACK_URL);
    if (callback.protocol !== 'https:' || callback.searchParams.get('k') !== env.MPESA_CALLBACK_TOKEN || env.MPESA_CALLBACK_TOKEN.length < 32) {
      return json({ error: 'The M-PESA callback URL is not configured correctly.' }, 503);
    }
  } catch {
    return json({ error: 'The M-PESA callback URL is invalid.' }, 503);
  }

  const token = await darajaToken(env);
  const timestamp = nairobiTimestamp();
  const password = btoa(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`);
  const isPayBill = env.MPESA_TRANSACTION_TYPE === 'CustomerPayBillOnline';
  if (!isPayBill && !env.MPESA_TILL_NUMBER) return json({ error: 'The M-PESA Till number is not configured.' }, 503);
  const reference = `MAUAAD${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  const response = await fetch(`${apiBase(env)}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: isPayBill ? 'CustomerPayBillOnline' : 'CustomerBuyGoodsOnline',
      Amount: booking.amount_kes,
      PartyA: phone,
      PartyB: isPayBill ? env.MPESA_SHORTCODE : env.MPESA_TILL_NUMBER,
      PhoneNumber: phone,
      CallBackURL: env.MPESA_CALLBACK_URL,
      AccountReference: reference,
      TransactionDesc: 'MauaAdvert',
    }),
  });
  const result = await response.json().catch(() => ({})) as {
    ResponseCode?: string; ResponseDescription?: string; CustomerMessage?: string;
    MerchantRequestID?: string; CheckoutRequestID?: string; errorMessage?: string;
  };
  if (!response.ok || result.ResponseCode !== '0' || !result.CheckoutRequestID) {
    return json({ error: result.errorMessage || result.ResponseDescription || 'Safaricom did not accept the payment request.' }, 502);
  }

  await db(env, `advertising_requests?id=eq.${encodeURIComponent(booking.id)}&payment_status=in.(unpaid,failed)`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      payment_status: 'pending',
      checkout_request_id: result.CheckoutRequestID,
      merchant_request_id: result.MerchantRequestID ?? null,
      payment_description: 'Waiting for M-PESA confirmation.',
      payment_result_code: null,
    }),
  });
  return json({
    requestId: booking.id,
    status: 'pending',
    message: result.CustomerMessage || 'Check your phone and approve the M-PESA payment prompt.',
  });
}
