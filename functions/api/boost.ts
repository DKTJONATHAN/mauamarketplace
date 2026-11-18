import { type Env, json, requireUser } from './boost-shared';
import { initiate, initiateAdvertising } from './boost-stk';
import {
  handleCallback,
  queryDarajaPayment,
  queryAdvertisingPayment,
  paymentStatus,
  advertisingPaymentStatus,
  latestPaymentForListing,
} from './boost-handlers';

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
