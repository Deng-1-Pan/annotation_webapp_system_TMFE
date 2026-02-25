insert into app_users (id, display_name, is_test_user, can_adjudicate, is_active)
values
  ('weijie-huang', 'Weijie Huang', false, false, true),
  ('arthur-hsu', 'Arthur HSU', false, false, true),
  ('yichen-hu', 'Yichen Hu', false, false, true),
  ('ruohan-zhong', 'Ruohan Zhong', false, false, true),
  ('deng-pan', 'Deng Pan', true, true, true)
on conflict (id) do update
set display_name = excluded.display_name,
    is_test_user = excluded.is_test_user,
    can_adjudicate = excluded.can_adjudicate,
    is_active = excluded.is_active,
    updated_at = now();

insert into task_configs (
  task_type, display_name, description, target_total_completed, target_min_per_label,
  coverage_labels_json, exclude_test_by_default, batch_strategy, batch_ratio
)
values
  ('ai_sentence_audit', 'AI句子识别审计', '验证关键词法是否误判/漏判。', 120, null, null, true, 'auto_mixed', null),
  ('role_audit_qa_turns', 'Q&A角色识别审计', '结合上下文核对角色标签。', 80, 20, '["analyst","management","operator","unknown"]'::jsonb, true, 'auto_mixed', null),
  ('qa_boundary_audit_docs', 'Q&A边界与配对质量', '检查 speech/qa 切分与 pairing。', 40, null, null, true, 'auto_mixed', null),
  ('initiation_audit_exchanges', 'AI Initiation 审计', '判断AI引出者类型。', 80, 20, '["analyst_initiated","management_pivot","analyst_only","non_ai"]'::jsonb, true, 'auto_mixed', null)
on conflict (task_type) do update
set display_name = excluded.display_name,
    description = excluded.description,
    target_total_completed = excluded.target_total_completed,
    target_min_per_label = excluded.target_min_per_label,
    coverage_labels_json = excluded.coverage_labels_json,
    exclude_test_by_default = excluded.exclude_test_by_default,
    batch_strategy = excluded.batch_strategy,
    batch_ratio = excluded.batch_ratio,
    updated_at = now();
