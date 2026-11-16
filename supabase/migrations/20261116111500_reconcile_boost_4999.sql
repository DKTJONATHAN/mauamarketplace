-- Keep Daraja 4999 transactions pending while Safaricom processes the STK request.
-- A query success is not proof of payment: only the verified callback can grant a boost.

create or replace function public.apply_listing_boost_payment(
  p_payment_id uuid,
  p_checkout_request_id text,
  p_result_code integer,
  p_result_description text,
  p_receipt_number text,
  p_amount numeric,
  p_phone text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  payment public.listing_boost_payments%rowtype;
begin
  select * into payment
  from public.listing_boost_payments
  where id = p_payment_id
    and checkout_request_id = p_checkout_request_id
  for update;

  if not found then
    return false;
  end if;

  if payment.status = 'paid' then
    return true;
  end if;

  -- Safaricom may use 4999 while an STK request is still processing.
  -- Keep it open for a later callback/query instead of failing it permanently.
  if p_result_code = 4999 then
    update public.listing_boost_payments
      set status = 'pending',
          result_code = p_result_code,
          result_description = left(coalesce(p_result_description, 'Transaction is still processing'), 500),
          updated_at = now()
      where id = payment.id;
    return true;
  end if;

  -- Allow a late success callback to recover a record previously marked 4999.
  if payment.status <> 'pending'
    and not (payment.status = 'failed' and payment.result_code = 4999)
  then
    return false;
  end if;

  if p_result_code = 0 then
    if p_receipt_number is null
      or length(p_receipt_number) < 6
      or p_amount is distinct from payment.amount::numeric
      or p_phone is distinct from payment.phone
    then
      return false;
    end if;

    update public.listing_boost_payments
      set status = 'paid',
          mpesa_receipt_number = p_receipt_number,
          result_code = p_result_code,
          result_description = left(coalesce(p_result_description, 'Payment confirmed'), 500),
          paid_at = now(),
          updated_at = now()
      where id = payment.id;

    update public.listings
      set featured_until = greatest(coalesce(featured_until, now()), now()) + interval '30 days'
      where id = payment.listing_id
        and seller_id = payment.user_id
        and status = 'active';

    if not found then
      raise exception 'The listing is no longer eligible for promotion.';
    end if;
    return true;
  end if;

  update public.listing_boost_payments
    set status = 'failed',
        result_code = p_result_code,
        result_description = left(coalesce(p_result_description, 'Payment was not completed'), 500),
        updated_at = now()
    where id = payment.id;
  return false;
end;
$$;

revoke all on function public.apply_listing_boost_payment(uuid, text, integer, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.apply_listing_boost_payment(uuid, text, integer, text, text, numeric, text) to service_role;

create or replace function public.reconcile_listing_boost_query(
  p_payment_id uuid,
  p_checkout_request_id text,
  p_result_code integer,
  p_result_description text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  payment public.listing_boost_payments%rowtype;
begin
  select * into payment
  from public.listing_boost_payments
  where id = p_payment_id
    and checkout_request_id = p_checkout_request_id
  for update;

  if not found then
    return false;
  end if;

  if payment.status = 'paid' then
    return true;
  end if;

  if payment.status not in ('pending', 'failed') then
    return false;
  end if;

  -- Query code 0 means processing succeeded at Daraja, but the query response
  -- does not carry receipt/amount/phone metadata. Wait for the verified callback.
  if p_result_code in (0, 4999) then
    update public.listing_boost_payments
      set status = 'pending',
          result_code = p_result_code,
          result_description = left(coalesce(p_result_description, 'Awaiting final payment callback'), 500),
          updated_at = now()
      where id = payment.id;
    return true;
  end if;

  update public.listing_boost_payments
    set status = 'failed',
        result_code = p_result_code,
        result_description = left(coalesce(p_result_description, 'Safaricom reported that payment was not completed'), 500),
        updated_at = now()
    where id = payment.id;
  return true;
end;
$$;

revoke all on function public.reconcile_listing_boost_query(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.reconcile_listing_boost_query(uuid, text, integer, text) to service_role;
