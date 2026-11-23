-- Directory sorted by name or joining date across all statuses — page 1 and every next page straight from an index.
CREATE INDEX IF NOT EXISTS employees_name_sort_ix   ON employees (tenant_id, full_name, employee_code);
CREATE INDEX IF NOT EXISTS employees_joined_sort_ix ON employees (tenant_id, date_of_joining, employee_code);
