{{- /* automation rules: "when X happens on this board, do Y" - trigger_config/actions store */ -}}
{{- /* free-form JSON, same convention as blocks.fields */ -}}
CREATE TABLE IF NOT EXISTS {{.prefix}}automation_rules (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    board_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_type VARCHAR(64) NOT NULL,

    {{if .mysql}}
    trigger_config JSON,
    actions JSON,
    {{end}}
    {{if .postgres}}
    trigger_config JSONB,
    actions JSONB,
    {{end}}
    {{if .sqlite}}
    trigger_config TEXT,
    actions TEXT,
    {{end}}

    created_by VARCHAR(36),
    modified_by VARCHAR(36),
    create_at BIGINT,
    update_at BIGINT,
    delete_at BIGINT
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};

{{ createIndexIfNeeded "automation_rules" "board_id" }}
