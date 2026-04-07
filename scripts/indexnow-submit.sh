#!/usr/bin/env bash
set -euo pipefail

HOST="itfactor.studio"
KEY="ce9fd6efa0194396ae790b9f7edffe1c"
API_URL="https://api.indexnow.org/indexnow"

usage() {
  cat <<'EOF'
Submit updated iT Factor URLs to IndexNow.

Usage:
  scripts/indexnow-submit.sh https://itfactor.studio/ https://itfactor.studio/pricing/
  scripts/indexnow-submit.sh urls.txt
  printf '%s\n' "https://itfactor.studio/" | scripts/indexnow-submit.sh

Notes:
  - Accepts absolute URLs, root-relative paths, or a text file with one URL/path per line.
  - Ignores blank lines and lines starting with #.
  - Do not submit noindex redirect pages such as /PrivacyPolicy.html and /TermsOfService.html.
EOF
}

trim_line() {
  local line="$1"
  line="${line%$'\r'}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  printf '%s' "$line"
}

normalize_url() {
  local value="$1"
  if [[ "$value" == https://* || "$value" == http://* ]]; then
    printf '%s' "$value"
    return
  fi

  if [[ "$value" == /* ]]; then
    printf 'https://%s%s' "$HOST" "$value"
    return
  fi

  printf 'https://%s/%s' "$HOST" "$value"
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/}"
  printf '%s' "$value"
}

collect_lines() {
  local source="$1"
  local line trimmed normalized

  while IFS= read -r line || [[ -n "$line" ]]; do
    trimmed="$(trim_line "$line")"
    if [[ -z "$trimmed" || "$trimmed" == \#* ]]; then
      continue
    fi
    normalized="$(normalize_url "$trimmed")"
    URLS+=("$normalized")
  done < "$source"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

declare -a URLS=()

if [[ $# -gt 0 ]]; then
  if [[ $# -eq 1 && -f "$1" ]]; then
    collect_lines "$1"
  else
    for arg in "$@"; do
      URLS+=("$(normalize_url "$arg")")
    done
  fi
elif [[ ! -t 0 ]]; then
  collect_lines /dev/stdin
else
  usage
  exit 1
fi

if [[ ${#URLS[@]} -eq 0 ]]; then
  echo "No URLs provided." >&2
  exit 1
fi

declare -a DEDUPED_URLS=()

url_seen() {
  local candidate="$1"
  local existing

  if [[ ${#DEDUPED_URLS[@]} -eq 0 ]]; then
    return 1
  fi

  for existing in "${DEDUPED_URLS[@]}"; do
    if [[ "$existing" == "$candidate" ]]; then
      return 0
    fi
  done

  return 1
}

for url in "${URLS[@]}"; do
  if [[ "$url" != https://"$HOST"* && "$url" != http://"$HOST"* ]]; then
    echo "Refusing to submit URL outside $HOST: $url" >&2
    exit 1
  fi

  if url_seen "$url"; then
    continue
  fi

  DEDUPED_URLS+=("$url")
done

json_urls=""
for url in "${DEDUPED_URLS[@]}"; do
  if [[ -n "$json_urls" ]]; then
    json_urls+=","
  fi
  json_urls+="\"$(json_escape "$url")\""
done

payload=$(printf '{"host":"%s","key":"%s","urlList":[%s]}' \
  "$(json_escape "$HOST")" \
  "$(json_escape "$KEY")" \
  "$json_urls")

curl --fail --silent --show-error \
  --header "Content-Type: application/json; charset=utf-8" \
  --data "$payload" \
  "$API_URL"

printf '\nSubmitted %s URL(s) to IndexNow for %s.\n' "${#DEDUPED_URLS[@]}" "$HOST"
