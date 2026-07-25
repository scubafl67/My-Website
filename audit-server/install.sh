#!/usr/bin/env bash
# =============================================================================
# CIPGuard Audit Server — One-Time Install
# Creates a sudoers NOPASSWD rule so audit_master.sh runs without a password
# prompt when triggered from the CIPGuard web UI.
#
# Run once: sudo bash install.sh
# Uninstall: sudo bash install.sh --uninstall
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUDIT_SCRIPT="$(cd "$SCRIPT_DIR/../../skills/launch-linux-baseline" && pwd)/audit_master.sh"
WRAPPER="/usr/local/bin/cipguard-audit"
SUDOERS_FILE="/etc/sudoers.d/cipguard-audit"
CURRENT_USER="${SUDO_USER:-$(whoami)}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${GREEN}[+]${RESET} $*"; }
warn() { echo -e "${YELLOW}[!]${RESET} $*"; }
err()  { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

if [[ "${1:-}" == "--uninstall" ]]; then
    log "Removing cipguard-audit wrapper and sudoers rule..."
    rm -f "$WRAPPER" && log "  Removed $WRAPPER"
    rm -f "$SUDOERS_FILE" && log "  Removed $SUDOERS_FILE"
    log "Uninstall complete."
    exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
    err "This script must be run with sudo: sudo bash install.sh"
    exit 1
fi

log "CIPGuard Audit Server — Install"
log "  User        : $CURRENT_USER"
log "  Audit script: $AUDIT_SCRIPT"
log "  Wrapper     : $WRAPPER"

if [[ ! -f "$AUDIT_SCRIPT" ]]; then
    err "audit_master.sh not found at: $AUDIT_SCRIPT"
    exit 1
fi

# ── Create wrapper script at /usr/local/bin/cipguard-audit ────────────────────
# Path without spaces avoids sudoers quoting edge cases.
# Wrapper reads AUDIT_MODULE and AUDIT_OUTPUT_DIR from environment (set by
# the Node.js server) so the sudoers rule covers a single fixed path.
log "Creating wrapper: $WRAPPER"
cat > "$WRAPPER" <<WRAPPER_EOF
#!/usr/bin/env bash
# cipguard-audit — CIPGuard UI wrapper for audit_master.sh
# Called by cipguard audit-server/server.js via: sudo cipguard-audit
set -uo pipefail
AUDIT_DIR="$(dirname "$AUDIT_SCRIPT")"
ARGS=()
MODULE="\${AUDIT_MODULE:-all}"
[[ "\$MODULE" != "all" ]] && ARGS+=("-m" "\$MODULE")
[[ -n "\${AUDIT_OUTPUT_DIR:-}" ]] && ARGS+=("-o" "\$AUDIT_OUTPUT_DIR")
exec bash "\$AUDIT_DIR/audit_master.sh" "\${ARGS[@]}"
WRAPPER_EOF

chmod 755 "$WRAPPER"
log "  Wrapper created."

# ── Add sudoers NOPASSWD rule ─────────────────────────────────────────────────
log "Writing sudoers rule: $SUDOERS_FILE"
cat > "$SUDOERS_FILE" <<SUDOERS_EOF
# CIPGuard Audit Suite — allows the audit-server Node.js process to launch
# audit_master.sh as root without a password prompt.
# Created by: cipguard-landing/audit-server/install.sh
Defaults env_keep += "AUDIT_MODULE AUDIT_OUTPUT_DIR"
$CURRENT_USER ALL=(ALL) NOPASSWD: $WRAPPER
SUDOERS_EOF

chmod 440 "$SUDOERS_FILE"

# Validate with visudo
if visudo -c -f "$SUDOERS_FILE" &>/dev/null; then
    log "  Sudoers rule validated."
else
    err "Sudoers syntax check failed — removing file for safety."
    rm -f "$SUDOERS_FILE"
    exit 1
fi

# ── Install Node.js dependencies for the audit server ────────────────────────
if command -v npm &>/dev/null; then
    log "Installing Node.js dependencies..."
    cd "$SCRIPT_DIR"
    sudo -u "$CURRENT_USER" npm install --silent
    log "  Dependencies installed."
else
    warn "npm not found — install Node.js, then run: cd audit-server && npm install"
fi

echo ""
log "${BOLD}Install complete.${RESET}"
log "  Start the audit server with:"
log "    ${CYAN}node \"$SCRIPT_DIR/server.js\"${RESET}"
log ""
log "  Or add to your shell profile for auto-start:"
log "    ${CYAN}echo 'node $SCRIPT_DIR/server.js &' >> ~/.zshrc${RESET}"
