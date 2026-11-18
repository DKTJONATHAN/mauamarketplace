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

async function initiate(env: Env, user: { id: string }, body: { listingId?: unknown; phone?: unknown }): Promise<Response> {
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

async function initiateAdvertising(env: Env, user: { id: string }, body: { requestId?: unknown; phone?: unknown }): Promise<Response> {
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
    const reason = result.errorMessage || result.ResponseDescription || 'Safaricom did not accept the payment request.';
    await db(env, `advertising_requests?id=eq.${encodeURIComponent(booking.id)}&payment_status=in.(unpaid,failed)`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        payment_status: 'failed',
        payment_description: reason.slice(0, 500),
        payment_result_code: null,
      }),
    }).catch(() => {});
    return json({ error: reason }, 502);
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
