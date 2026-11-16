alter table public.advertising_requests
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed')),
  add column if not exists checkout_request_id text,
  add column if not exists merchant_request_id text,
  add column if not exists mpesa_receipt_number text,
  add column if not exists payment_result_code integer,
  add column if not exists payment_description text,
  add column if not exists paid_at timestamptz;

create unique index if not exists advertising_requests_checkout_request_uidx
  on public.advertising_requests (checkout_request_id)
  where checkout_request_id is not null;
