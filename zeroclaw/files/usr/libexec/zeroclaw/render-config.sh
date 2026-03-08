#!/bin/sh

set -eu

UCI_PATH="zeroclaw.main"
OUT_DIR="/etc/zeroclaw"
OUT_FILE="$OUT_DIR/config.toml"
WORKSPACE_DIR="${ZEROCLAW_RENDER_WORKSPACE:-$(uci -q get ${UCI_PATH}.workspace 2>/dev/null || printf '/var/lib/zeroclaw')}"
WORKSPACE_CONFIG="$WORKSPACE_DIR/config.toml"

get_opt() {
	local key="$1"
	local default="${2-}"
	uci -q get "$UCI_PATH.$key" 2>/dev/null || printf '%s' "$default"
}

bool_opt() {
	case "$(get_opt "$1" "$2")" in
		1|true|yes|on) printf 'true' ;;
		*) printf 'false' ;;
	esac
}

toml_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

append_string() {
	local key="$1"
	local value="$2"
	[ -n "$value" ] || return 0
	printf '%s = "%s"\n' "$key" "$(toml_escape "$value")" >> "$TMP_FILE"
}

mkdir -p "$OUT_DIR" "$WORKSPACE_DIR"

HOST="$(get_opt host '127.0.0.1')"
PORT="$(get_opt port '42617')"
ALLOW_PUBLIC_BIND="$(bool_opt allow_public_bind 0)"
PROVIDER="$(get_opt provider 'openrouter')"
MODEL="$(get_opt model '')"
API_BASE="$(get_opt api_base '')"
API_KEY="$(get_opt api_key '')"
TMP_FILE="$(mktemp /tmp/zeroclaw-config.XXXXXX)"
trap 'rm -f "$TMP_FILE"' EXIT INT TERM

append_string "default_provider" "$PROVIDER"
append_string "default_model" "$MODEL"
append_string "api_key" "$API_KEY"
append_string "api_url" "$API_BASE"

printf '[gateway]\n' >> "$TMP_FILE"
printf 'host = "%s"\n' "$(toml_escape "$HOST")" >> "$TMP_FILE"
printf 'port = %s\n' "$PORT" >> "$TMP_FILE"
printf 'allow_public_bind = %s\n' "$ALLOW_PUBLIC_BIND" >> "$TMP_FILE"

printf '[observability]\n' >> "$TMP_FILE"
printf 'backend = "log"\n' >> "$TMP_FILE"

cp "$TMP_FILE" "$OUT_FILE"
mv "$TMP_FILE" "$WORKSPACE_CONFIG"
trap - EXIT INT TERM

exit 0
