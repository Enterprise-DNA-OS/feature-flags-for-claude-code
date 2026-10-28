create table environments (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 owner text not null default '', document jsonb not null default '{"f":{}}',
 revision integer not null default 0 check(revision>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table flag_register (
 id uuid primary key default gen_random_uuid(), environment_id uuid not null references environments,
 key text not null, owner text not null default '', purpose text not null default '',
 review_on date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(environment_id,key)
);
create table changes (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 environment_id uuid not null references environments, base_revision integer not null,
 document jsonb not null, requested_by text not null, reason text not null,
 due_on date not null, state text not null default 'pending' check(state in ('pending','approved','released','rejected')),
 impact text not null, rollback_plan text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table checks (
 id uuid primary key default gen_random_uuid(), change_id uuid not null references changes,
 actor text not null, passed boolean not null, cases jsonb not null, results jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table decisions (
 id uuid primary key default gen_random_uuid(), change_id uuid not null references changes,
 actor text not null, decision text not null check(decision in ('approve','reject')),
 evidence text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table releases (
 id uuid primary key default gen_random_uuid(), environment_id uuid not null references environments,
 change_id uuid unique references changes, revision integer not null, document jsonb not null,
 actor text not null, reason text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(environment_id,revision)
);
create table activity (
 id uuid primary key default gen_random_uuid(), actor text not null, action text not null,
 reference text not null, detail jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), environment_id uuid not null references environments,
 digest text not null, flag_count integer not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(environment_id,digest)
);
create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
do $$ declare t text; begin foreach t in array array['environments','flag_register','changes','checks','decisions','releases','activity','imports'] loop
 execute format('create trigger touch before update on %I for each row execute function touch_updated_at()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
end loop; end $$;
create view flag_inventory as
 select r.id,e.name environment,r.key,r.owner,r.purpose,r.review_on,
 case (e.document->'f'->r.key->>'t')::int when 0 then 'boolean' when 1 then 'text' when 2 then 'integer' when 3 then 'decimal' end kind,
 e.document->'f'->r.key->'v' default_value,
 jsonb_array_length(coalesce(e.document->'f'->r.key->'r','[]')) rules,e.revision
 from flag_register r join environments e on e.id=r.environment_id where e.document->'f' ? r.key;
create view change_queue as
 select c.id,c.code,e.name environment,c.requested_by,c.due_on,c.state,c.base_revision,e.revision current_revision,
 c.base_revision<>e.revision stale,
 (select passed from checks x where x.change_id=c.id order by created_at desc,id desc limit 1) tests_passed
 from changes c join environments e on e.id=c.environment_id;
create view attention_items as
 select environment,key item,'owner missing' issue,review_on due_on from flag_inventory where owner=''
 union all select environment,key,'purpose missing',review_on from flag_inventory where purpose=''
 union all select environment,key,'review overdue or missing',review_on from flag_inventory where review_on is null or review_on<current_date
 union all select environment,code,'change overdue',due_on from change_queue where state in ('pending','approved') and due_on<current_date
 union all select environment,code,'proposal based on an older revision',due_on from change_queue where state in ('pending','approved') and stale;
create view compliance_findings as
 select 'OWNERSHIP' rule,environment,key item,'Assign an owner and purpose' finding from flag_inventory where owner='' or purpose=''
 union all select 'REVIEW',environment,key,'Review date missing or overdue' from flag_inventory where review_on is null or review_on<current_date
 union all select 'STALE-CHANGE',environment,code,'Rebase and retest before approval' from change_queue where state in ('pending','approved') and stale
 union all select 'TEST-EVIDENCE',environment,code,'Latest tests must pass before release' from change_queue where state='approved' and tests_passed is distinct from true
 union all select 'SEPARATE-REVIEWER',e.name,c.code,'Approval requires a different named reviewer' from changes c join environments e on e.id=c.environment_id
 where c.state in ('approved','released') and not exists(select 1 from decisions d where d.change_id=c.id and d.decision='approve' and lower(d.actor)<>lower(c.requested_by));
