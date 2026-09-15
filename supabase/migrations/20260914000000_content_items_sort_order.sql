-- Griglia (the profile-order grid view) needs an explicit manual order,
-- independent of publish date — the legacy app got this for free from
-- array order in its JSON blob; a real table needs a real column.
alter table content_items add column sort_order integer not null default 0;
create index content_items_sort_order_idx on content_items (account_id, kind, sort_order);
