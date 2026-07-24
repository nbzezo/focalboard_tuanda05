{{- /* supports ORDER BY board_id, id with an efficient keyset/offset scan for paginated block reads */ -}}
{{ createIndexIfNeeded "blocks" "board_id, id" }}
