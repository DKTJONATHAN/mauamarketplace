do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'advertising_requests_price_matches_package'
      and conrelid = 'public.advertising_requests'::regclass
  ) then
    alter table public.advertising_requests
      add constraint advertising_requests_price_matches_package
      check (
        (placement = 'homepage_banner' and (
          (duration_days = 7 and amount_kes = 500) or
          (duration_days = 30 and amount_kes = 1500)
        )) or
        (placement = 'category_feature' and (
          (duration_days = 7 and amount_kes = 300) or
          (duration_days = 30 and amount_kes = 900)
        )) or
        (placement = 'business_spotlight' and (
          (duration_days = 7 and amount_kes = 250) or
          (duration_days = 30 and amount_kes = 700)
        ))
      );
  end if;
end
$$;
