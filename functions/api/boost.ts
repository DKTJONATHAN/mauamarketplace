interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MPESA_CONSUMER_KEY?: string;
  MPESA_CONSUMER_SECRET?: string;
  MPESA_SHORTCODE?: string;
  MPESA_TILL_NUMBER?: string;
  MPESA_PASSKEY?: string;
  MPESA_CALLBACK_URL?: string;
  MPESA_CALLBACK_TOKEN?: string;
  MPESA_ENVIRONMENT?: string;
  MPESA_TRANSACTION_TYPE?: string;
}

type DbPayment = {
  id: string;
  user_id: string;
  listing_id: string;
  phone: string;
  amount: number;
  status: string;
  checkout_request_id: string | null;
};

const PRICE_KES = 250;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s()+-]/g, '');
  const normalized = digits.startsWith('0') ? `254${digits.slice(1)}`
    : digits.startsWith('7') || digits.startsWith('1') ? `254${digits}`
    : digits;
  return /^254[17]\d{8}$/.test(normalized) ? normalized : null;
}

function supabaseHeaders(env: Env): HeadersInit {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function db<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: { ...supabaseHeaders(env), ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`Database request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

async function requireUser(request: Request, env: Env): Promise<{ id: string } | null> {
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return user.id ? { id: user.id } : null;
}

function nairobiTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}${value.hour}${value.minute}${value.second}`;
}

function apiBase(env: Env): string {
  return env.MPESA_ENVIRONMENT?.toLowerCase() === 'sandbox'
    ? 'https://sandbox.safaricom.co.ke'
    : 'https://api.safaricom.co.ke';
}

async function darajaToken(env: Env): Promise<string> {
  if (!env.MPESA_CONSUMER_KEY || !env.MPESA_CONSUMER_SECRET) {
    throw new Error('M-PESA Daraja credentials are not configured.');
  }
  const credentials = btoa(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`);
  const response = await fetch(`${apiBase(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  const payload = await response.json().catch(() => ({})) as {
    access_token?: string;
    errorMessage?: string;
    error?: string;
    error_description?: string;
    message?: string;
  };
  if (!response.ok || !payload.access_token) {
    const reason = payload.errorMessage || payload.error_description || payload.error || payload.message;
    throw new Error(`Daraja OAuth authentication failed (HTTP ${response.status}): ${reason || 'Safaricom returned no access token.'}`);
  }
  return payload.access_token;
}

async function markInitiationFailed(env: Env, paymentId: string, reason: string): Promise<void> {
  await db(env, `listing_boost_payments?id=eq.${encodeURIComponent(paymentId)}&status=eq.initiating`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'failed', result_description: reason.slice(0, 500) }),
  });
}

async function initiate(request: Request, env: Env, user: { id: string }): Promise<Response> {
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

async function initiateAdvertising(request: Request, env: Env, user: { id: string }): Promise<Response> {
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

function callbackValue(items: { Name?: string; Value?: string | number }[] | undefined, name: string): string | number | null {
  const value = items?.find(item => item.Name === name)?.Value;
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
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
      const startDate = new Date(`${booking.start_date}T00:00:00.000Z`);
      const endDate = new Date(startDate.getTime() + (booking.duration_days - 1) * 86400000).toISOString().slice(0, 10);
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
          start_date: booking.start_date,
          end_date: endDate,
          status: 'pending_review',
        }),
      });
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
        payment_description: (callback.ResultDesc ?? 'Payment was not completed.').slice(0, 500),
      }),
    });
    return json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const rpcResult = await db<boolean>(env, 'rpc/apply_listing_boost_payment', {
    method: 'POST',
    body: JSON.stringify({
      p_payment_id: payment.id,
      p_checkout_request_id: callback.CheckoutRequestID,
      p_result_code: callback.ResultCode,
      p_result_description: callback.ResultDesc ?? '',
      p_receipt_number: typeof receipt === 'string' ? receipt : null,
      p_amount: Number.isFinite(validAmount) ? validAmount : null,
      p_phone: paidPhone,
    }),
  });
  if (callback.ResultCode === 0 && rpcResult !== true) {
    return json({ ResultCode: 1, ResultDesc: 'Payment details could not be verified.' }, 409);
  }
  return json({ ResultCode: 0, ResultDesc: 'Accepted' });
}

async function queryDarajaPayment(env: Env, user: { id: string }, paymentId: unknown): Promise<Response> {
  if (typeof paymentId !== 'string' || !UUID_RE.test(paymentId)) {
    return json({ error: 'Invalid payment reference.' }, 400);
  }
  if (!env.MPESA_SHORTCODE || !env.MPESA_PASSKEY) {
    return json({ error: 'M-PESA query credentials are not configured.' }, 503);
  }
  const rows = await db<{
    id: string;
    user_id: string;
    checkout_request_id: string | null;
    status: string;
  }[]>(env,
    `listing_boost_payments?select=id,user_id,checkout_request_id,status&id=eq.${encodeURIComponent(paymentId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
  );
  const payment = rows[0];
  if (!payment) return json({ error: 'Payment not found.' }, 404);
  if (!payment.checkout_request_id) {
    return json({ error: 'Safaricom has not issued a CheckoutRequestID for this payment, so it cannot be queried.' }, 409);
  }
  if (!['pending', 'failed'].includes(payment.status)) {
    return json({ error: 'Only pending or failed payments can be queried.' }, 409);
  }

  const token = await darajaToken(env);
  const timestamp = nairobiTimestamp();
  const password = btoa(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`);
  const response = await fetch(`${apiBase(env)}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: payment.checkout_request_id,
    }),
  });
  const result = await response.json().catch(() => ({})) as {
    ResponseCode?: string;
    ResponseDescription?: string;
    ResultCode?: string | number;
    ResultDesc?: string;
    errorCode?: string;
    errorMessage?: string;
  };
  if (!response.ok) {
    const reason = result.errorMessage || result.ResponseDescription || 'Safaricom rejected the query request.';
    return json({
      error: `Daraja STK Push Query failed (HTTP ${response.status}${result.errorCode ? `, code ${result.errorCode}` : ''}): ${reason}`,
    }, 502);
  }
  const queryResultCode = result.ResultCode === undefined ? null : Number(result.ResultCode);
  if (queryResultCode !== null && Number.isInteger(queryResultCode) && queryResultCode >= 0) {
    await db<boolean>(env, 'rpc/reconcile_listing_boost_query', {
      method: 'POST',
      body: JSON.stringify({
        p_payment_id: payment.id,
        p_checkout_request_id: payment.checkout_request_id,
        p_result_code: queryResultCode,
        p_result_description: result.ResultDesc ?? '',
      }),
    });
  }
  return json({
    responseCode: result.ResponseCode ?? null,
    responseDescription: result.ResponseDescription ?? null,
    resultCode: result.ResultCode ?? null,
    resultDescription: result.ResultDesc ?? null,
  });
}

async function paymentStatus(request: Request, env: Env, user: { id: string }): Promise<Response> {
  const paymentId = new URL(request.url).searchParams.get('paymentId');
  if (!paymentId || !UUID_RE.test(paymentId)) return json({ error: 'Invalid payment reference.' }, 400);
  const rows = await db<{ id: string; user_id: string; status: string; result_code: number | null; result_description: string | null; paid_at: string | null }[]>(
    env,
    `listing_boost_payments?select=id,user_id,status,result_code,result_description,paid_at&id=eq.${encodeURIComponent(paymentId)}&limit=1`,
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

async function queryAdvertisingPayment(env: Env, user: { id: string }, requestId: unknown): Promise<Response> {
  if (typeof requestId !== 'string' || !UUID_RE.test(requestId)) return json({ error: 'Invalid advertising request.' }, 400);
  if (!env.MPESA_SHORTCODE || !env.MPESA_PASSKEY) return json({ error: 'M-PESA query credentials are not configured.' }, 503);
  const rows = await db<{
    id: string; user_id: string; checkout_request_id: string | null; payment_status: string;
  }[]>(env, `advertising_requests?select=id,user_id,checkout_request_id,payment_status&id=eq.${encodeURIComponent(requestId)}&limit=1`);
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
    body: JSON.stringify({
      BusinessShortCode: env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: booking.checkout_request_id,
    }),
  });
  const result = await response.json().catch(() => ({})) as {
    ResponseCode?: string; ResponseDescription?: string; ResultCode?: string | number;
    ResultDesc?: string; errorMessage?: string;
  };
  if (!response.ok) return json({ error: result.errorMessage || result.ResponseDescription || 'Safaricom could not check this payment.' }, 502);
  const resultCode = result.ResultCode === undefined ? null : Number(result.ResultCode);
  if (resultCode !== null && Number.isInteger(resultCode) && resultCode !== 0 && resultCode !== 4999) {
    await db(env, `advertising_requests?id=eq.${encodeURIComponent(booking.id)}&payment_status=eq.pending`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        payment_status: 'failed',
        payment_result_code: resultCode,
        payment_description: (result.ResultDesc || 'Payment was not completed.').slice(0, 500),
      }),
    });
  }
  return json({
    status: resultCode === 0 || resultCode === 4999 || resultCode === null ? 'pending' : 'failed',
    resultCode,
    resultDescription: result.ResultDesc || result.ResponseDescription || 'Waiting for M-PESA callback confirmation.',
  });
}

async function advertisingPaymentStatus(request: Request, env: Env, user: { id: string }): Promise<Response> {
  const requestId = new URL(request.url).searchParams.get('advertisingRequestId');
  if (!requestId || !UUID_RE.test(requestId)) return json({ error: 'Invalid advertising request.' }, 400);
  const rows = await db<{
    id: string; user_id: string; payment_status: string; payment_result_code: number | null;
    payment_description: string | null; paid_at: string | null;
  }[]>(env, `advertising_requests?select=id,user_id,payment_status,payment_result_code,payment_description,paid_at&id=eq.${encodeURIComponent(requestId)}&limit=1`);
  const booking = rows[0];
  if (!booking || booking.user_id !== user.id) return json({ error: 'Advertising request not found.' }, 404);
  return json({
    status: booking.payment_status,
    resultCode: booking.payment_result_code,
    message: booking.payment_description || (booking.payment_status === 'paid' ? 'Payment confirmed.' : 'Waiting for M-PESA confirmation.'),
    paidAt: booking.paid_at,
  });
}

async function latestPaymentForListing(request: Request, env: Env, user: { id: string }): Promise<Response> {
  const listingId = new URL(request.url).searchParams.get('listingId');
  if (!listingId || !UUID_RE.test(listingId)) return json({ error: 'Invalid listing reference.' }, 400);
  const rows = await db<{
    id: string;
    status: string;
    result_description: string | null;
    paid_at: string | null;
  }[]>(env,
    `listing_boost_payments?select=id,status,result_description,paid_at&user_id=eq.${encodeURIComponent(user.id)}&listing_id=eq.${encodeURIComponent(listingId)}&order=created_at.desc&limit=1`,
  );
  const payment = rows[0];
  if (!payment || !['pending', 'failed'].includes(payment.status)) {
    return json({ paymentId: null });
  }
  return json({
    paymentId: payment.id,
    status: payment.status,
    message: payment.status === 'failed'
      ? (payment.result_description || 'Payment was not completed.')
      : 'Waiting for Safaricom to confirm your payment.',
    paidAt: payment.paid_at,
  });
}

type PagesContext = { request: Request; env: Env };

export const onRequestPost = async ({ request, env }: PagesContext) => {
  try {
    const body = await request.clone().json() as { Body?: { stkCallback?: unknown }; action?: string; paymentId?: unknown; requestId?: unknown };
    if (body?.Body?.stkCallback) return await handleCallback(request, env);
    const user = await requireUser(request, env);
    if (!user) return json({ error: 'Please sign in again.' }, 401);
    const action = body?.action;
    if (action === 'query') return await queryDarajaPayment(env, user, body?.paymentId);
    if (action === 'advertise') return await initiateAdvertising(request, env, user);
    if (action === 'query_advertising') return await queryAdvertisingPayment(env, user, body?.requestId);
    return await initiate(request, env, user);
  } catch (error) {
    console.error('Maua Boost request failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: error instanceof Error ? error.message : 'Payment request failed. Please try again.' }, 500);
  }
};

export const onRequestGet = async ({ request, env }: PagesContext) => {
  try {
    const user = await requireUser(request, env);
    if (!user) return json({ error: 'Please sign in again.' }, 401);
    if (new URL(request.url).searchParams.has('advertisingRequestId')) return await advertisingPaymentStatus(request, env, user);
    if (new URL(request.url).searchParams.has('paymentId')) return await paymentStatus(request, env, user);
    return await latestPaymentForListing(request, env, user);
  } catch (error) {
    console.error('Maua Boost status lookup failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Could not check payment status. Please try again.' }, 500);
  }
};
