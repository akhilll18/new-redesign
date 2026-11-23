-- Next free number per code prefix (EMP…), so two admins adding people at the same moment never get the same code.
CREATE TABLE IF NOT EXISTS code_counters (
  tenant_id text NOT NULL,
  prefix    text NOT NULL,
  last      bigint NOT NULL,
  PRIMARY KEY (tenant_id, prefix)
);
