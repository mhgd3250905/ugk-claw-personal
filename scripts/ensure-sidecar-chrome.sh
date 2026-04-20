#!/bin/sh

set -eu

PROFILE_DIR="${WEB_ACCESS_BROWSER_PROFILE_DIR:-/config/chrome-profile-sidecar}"
BROWSER_BIN="${WEB_ACCESS_BROWSER_BIN:-/usr/bin/google-chrome}"
CDP_URL="${WEB_ACCESS_BROWSER_LOCAL_CDP_URL:-http://127.0.0.1:9222/json/version}"
LOG_FILE="${WEB_ACCESS_BROWSER_LOG_FILE:-/config/chrome-manual.log}"

is_ready() {
  curl -fsS "$CDP_URL" >/dev/null 2>&1
}

has_browser_process() {
  pgrep -x google-chrome >/dev/null 2>&1 || pgrep -x chrome >/dev/null 2>&1
}

start_browser() {
  mkdir -p "$PROFILE_DIR"
  rm -f "$PROFILE_DIR/SingletonCookie" "$PROFILE_DIR/SingletonLock" "$PROFILE_DIR/SingletonSocket"

  cat > /tmp/start-sidecar-chrome.sh <<EOF
#!/bin/sh
export HOME=/config
export DISPLAY=:0
exec "$BROWSER_BIN" \\
  --no-first-run \\
  --no-sandbox \\
  --password-store=basic \\
  --hide-crash-restore-bubble \\
  --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \\
  --start-maximized \\
  --test-type \\
  --ozone-platform=x11 \\
  --remote-debugging-address=0.0.0.0 \\
  --remote-debugging-port=9222 \\
  --user-data-dir="$PROFILE_DIR" \\
  about:blank
EOF

  chmod +x /tmp/start-sidecar-chrome.sh
  su -s /bin/sh abc -c "/tmp/start-sidecar-chrome.sh >> \"$LOG_FILE\" 2>&1 &"
}

main() {
  if is_ready; then
    exit 0
  fi

  if [ ! -x "$BROWSER_BIN" ]; then
    echo "sidecar chrome binary not found: $BROWSER_BIN" >&2
    exit 1
  fi

  if ! has_browser_process; then
    start_browser
  fi

  attempt=0
  while [ "$attempt" -lt 20 ]; do
    if is_ready; then
      exit 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "sidecar chrome CDP did not become ready" >&2
  exit 1
}

main "$@"
