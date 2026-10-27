-- Existing rules mixed automatic guesses and user choices. Preserve their
-- unknown provenance; only new explicit edits are marked manual.
alter table public.user_category_rules
  add column source text not null default 'legacy'
  constraint user_category_rules_source_check check (source in ('legacy', 'manual', 'ai'));

comment on column public.user_category_rules.source is
  'manual = explicit user choice; ai = automatic suggestion; legacy = unknown origin';
