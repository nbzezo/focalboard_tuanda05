{{- /* run log for automation rules - lets the rule list UI show whether a rule has fired and with what result */ -}}
CREATE TABLE IF NOT EXISTS {{.prefix}}automation_runs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    rule_id VARCHAR(36) NOT NULL,
    card_id VARCHAR(36) NOT NULL,
    status VARCHAR(32) NOT NULL,
    error TEXT,
    create_at BIGINT
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};

{{ createIndexIfNeeded "automation_runs" "rule_id, create_at" }}
