-- Scanner import: stable source identity and atomic insert into existing deals.
-- Execute after review; no automatic analysis, ratings or market prices.
create sequence if not exists public.scanner_discovery_id_seq;
select setval('public.scanner_discovery_id_seq', greatest(coalesce((select max(id) from public.discoveries),0)+1000,1000000000),false);
create table if not exists public.scanner_import_items(
  id bigint generated always as identity primary key,
  source_key text not null unique,
  discovery_id bigint not null references public.discoveries(id) on delete cascade,
  filename text not null,
  source_line integer not null,
  imported_by uuid not null,
  imported_at timestamptz not null default now()
);
alter table public.scanner_import_items enable row level security;
revoke all on public.scanner_import_items from anon,authenticated;
create or replace function public.scanner_insert_deal(
 p_source_key text,p_filename text,p_line integer,p_user uuid,p_product text,p_brand text,p_ean text,p_mpn text,
 p_quantity integer,p_price numeric,p_supplier text
) returns table(created boolean,deal_id bigint)
language plpgsql security invoker set search_path=public as $$
declare new_id bigint; existing_id bigint;
begin
 select discovery_id into existing_id from public.scanner_import_items where source_key=p_source_key;
 if existing_id is not null then return query select false,existing_id;return;end if;
 new_id:=nextval('public.scanner_discovery_id_seq');
 insert into public.discoveries(id,product_name,brand,ean_gtin,mpn,quantity,purchase_price,supplier_name,offer_url,hunt_origin,currency)
 values(new_id,p_product,nullif(p_brand,''),nullif(p_ean,''),nullif(p_mpn,''),p_quantity,p_price,nullif(p_supplier,''),'scanner://import/'||p_source_key,'PERMANENT','EUR');
 insert into public.scanner_import_items(source_key,discovery_id,filename,source_line,imported_by)
 values(p_source_key,new_id,p_filename,p_line,p_user);
 return query select true,new_id;
end $$;
revoke all on function public.scanner_insert_deal(text,text,integer,uuid,text,text,text,text,integer,numeric,text) from public,anon,authenticated;
grant execute on function public.scanner_insert_deal(text,text,integer,uuid,text,text,text,text,integer,numeric,text) to service_role;
