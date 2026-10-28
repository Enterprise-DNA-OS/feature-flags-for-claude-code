insert into environments(id,name,owner,document) values
 ('10000000-0000-4000-8000-000000000001','Kauri production','Mere','{"p":{"r":0},"f":{"new_checkout":{"t":0,"v":{"b":false},"r":[{"c":[{"u":{"a":"Country","c":0,"l":["NZ"]}}],"s":{"v":{"b":true}}}]},"legacy_banner":{"t":1,"v":{"s":"Welcome"}},"retry_limit":{"t":2,"v":{"i":3}}}}'),
 ('10000000-0000-4000-8000-000000000002','Kauri staging','Lin','{"p":{"r":0},"f":{"new_checkout":{"t":0,"v":{"b":true}},"legacy_banner":{"t":1,"v":{"s":"Preview"}},"retry_limit":{"t":2,"v":{"i":3}}}}')
 on conflict do nothing;
insert into flag_register(environment_id,key,owner,purpose,review_on)
 select e.id,k,case when k='legacy_banner' then '' else e.owner end,
 case when k='new_checkout' then 'Pilot the checkout change in New Zealand' when k='retry_limit' then 'Bound retry attempts' else 'Retire the old welcome banner' end,
 case when k='legacy_banner' then current_date-10 else current_date+30 end
 from environments e cross join lateral jsonb_object_keys(e.document->'f') k on conflict do nothing;
insert into releases(environment_id,revision,document,actor,reason)
 select id,0,document,'Demo seed','Initial fictional baseline' from environments on conflict do nothing;
insert into changes(id,code,environment_id,base_revision,document,requested_by,reason,due_on,impact,rollback_plan)
 select '20000000-0000-4000-8000-000000000001','CHECKOUT-01',id,revision,
 jsonb_set(document,'{f,new_checkout,v,b}','true'),'Lin','Enable the default checkout after the pilot',current_date-2,
 'Changes the default for customers outside New Zealand','Restore the previous approved snapshot'
 from environments where name='Kauri production' on conflict do nothing;
