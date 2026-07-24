{{if .mysql}}
DROP INDEX idx_blocks_board_id_id ON {{.prefix}}blocks;
{{end}}

{{if .postgres}}
DROP INDEX IF EXISTS idx_blocks_board_id_id;
{{end}}

{{if .sqlite}}
DROP INDEX IF EXISTS idx_blocks_board_id_id;
{{end}}
