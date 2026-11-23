-- Department lists sorted by name (team pages, colleague lists) without sorting lakhs of rows.
CREATE INDEX IF NOT EXISTS employees_dept_name_ix ON employees (tenant_id, department, status, full_name, employee_code);
DROP INDEX IF EXISTS employees_dept_ix;
