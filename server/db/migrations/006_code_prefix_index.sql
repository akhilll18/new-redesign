-- Employee-code prefix search ("E0123…", "EMP04…") straight from an index.
CREATE INDEX IF NOT EXISTS employees_code_prefix_ix ON employees (tenant_id, employee_code text_pattern_ops);
