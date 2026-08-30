# iii-engine Manual Installation untuk HaruDex

## Status: ✅ Installed and Running

iii-engine v0.11.2 sudah berhasil diinstall secara manual dan agentmemory daemon berjalan dalam **full mode** (54 tools).

---

## Problem

Windows tidak mendukung auto-install iii-engine via `npx @agentmemory/agentmemory` karena format zip yang tidak kompatibel dengan tar. Perlu install manual dari GitHub release.

---

## Solution

Menggunakan binary yang sudah ada dari `C:\Users\FSOS\OneDrive\GITHUB\.agentmemory\bin\iii.exe` (versi 0.11.2 yang kompatibel) dan copy ke lokasi standar di PATH.

---

## Installation Steps

### 1. Verify Binary Version
```bash
"C:/Users/FSOS/OneDrive/GITHUB/.agentmemory/bin/iii.exe" --version
# Output: 0.11.2
```

### 2. Install to Standard Location
```bash
mkdir "C:\Users\FSOS\.local\bin"
copy "C:\Users\FSOS\OneDrive\GITHUB\.agentmemory\bin\iii.exe" "C:\Users\FSOS\.local\bin\iii.exe"
```

### 3. Verify Installation
```bash
"C:\Users\FSOS\.local\bin\iii.exe" --version
# Output: 0.11.2
```

### 4. Check PATH
```bash
where.exe iii.exe
# Should show: C:\Users\FSOS\.local\bin\iii.exe
```

---

## Daemon Status

### Full Mode Active
```bash
npx @agentmemory/agentmemory status
```

**Output:**
```
┌  agentmemory status
│
◆  Connected — v0.9.29 at http://localhost:3111
│
◇  agentmemory ──────────────────────────────────────────────────────────────╮
│                                                                            │
│  Health:       ✓ healthy                                                   │
│  Sessions:     0                                                           │
│  Observations: 0                                                           │
│  Memories:     0                                                           │
│  Graph:        0 nodes, 0 edges                                            │
│  Circuit:      closed                                                      │
│  Heap:         25 MB                                                       │
│  Uptime:       301s                                                        │
│  Viewer:       http://localhost:3113                                       │
│                                                                            │
│  Provider:     ✗ noop (no key)                                             │
│  Embeddings:   ✓ embeddings                                                │
│  Flags:                                                                    │
│    ✓ GRAPH_EXTRACTION_ENABLED         Knowledge graph extraction           │
│    ✗ CONSOLIDATION_ENABLED            Memory consolidation                 │
│    ✗ AGENTMEMORY_AUTO_COMPRESS        LLM-powered observation compression  │
│    ✓ AGENTMEMORY_INJECT_CONTEXT       In-conversation context injection    │
│                                                                            │
│  Followup rate: 0/0 (0%) within 30s — directional, may overcount on        │
│  refinement                                                                │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────╯
```

### Ports Listening
```bash
netstat -ano | findstr ":3111 :3112 :3113"
```

**Output:**
```
  TCP    127.0.0.1:3111         0.0.0.0:0              LISTENING       24464
  TCP    127.0.0.1:3112         0.0.0.0:0              LISTENING       24464
  TCP    127.0.0.1:3113         0.0.0.0:0              LISTENING       6228
```

---

## MCP Configuration Update

File `.mcp.json` diupdate untuk menggunakan **full daemon mode** (bukan standalone):

```json
{
  "mcpServers": {
    "agentmemory": {
      "command": "npx",
      "args": ["--yes", "@agentmemory/agentmemory", "mcp"],
      "env": {
        "AGENTMEMORY_INJECT_CONTEXT": "true",
        "GRAPH_EXTRACTION_ENABLED": "true",
        "EMBEDDING_PROVIDER": "local",
        "AGENTMEMORY_URL": "http://localhost:3111"
      }
    }
  }
}
```

**Key changes:**
- ❌ Removed `STANDALONE_MCP: "1"`
- ✅ Added `AGENTMEMORY_URL: "http://localhost:3111"`

---

## Available Tools (54 Total)

Dengan full mode, sekarang ada 54 tools yang tersedia (vs 7 di standalone mode). Test:

```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npx --yes @agentmemory/agentmemory mcp
```

---

## Files Changed

| File | Change |
|------|--------|
| `.mcp.json` | Updated to full daemon mode |
| `C:\Users\FSOS\.local\bin\iii.exe` | Installed iii-engine v0.11.2 |
| `C:\Users\FSOS\.agentmemory\.env` | Merged project settings |
| `C:\Users\FSOS\.agentmemory\preferences.json` | First-run wizard completed |

---

## Verification

| Check | Command | Result |
|-------|---------|--------|
| iii-engine version | `iii.exe --version` | ✅ 0.11.2 |
| Daemon health | `npx @agentmemory/agentmemory status` | ✅ Connected, healthy |
| Port 3111 | `netstat -ano \| findstr ":3111"` | ✅ LISTENING |
| Port 3112 | `netstat -ano \| findstr ":3112"` | ✅ LISTENING |
| Port 3113 | `netstat -ano \| findstr ":3113"` | ✅ LISTENING |
| MCP tools | `tools/list` via MCP | ✅ 54 tools available |

---

## Troubleshooting

### Daemon Not Starting
```bash
# Check if iii.exe is in PATH
where.exe iii.exe

# Check version
iii.exe --version

# Restart daemon
npx @agentmemory/agentmemory
```

### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr ":3111"

# Kill process (replace PID)
taskkill /PID <PID> /F

# Restart daemon
npx @agentmemory/agentmemory
```

### MCP Connection Issues
```bash
# Check MCP config
type .mcp.json

# Test MCP connection
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npx --yes @agentmemory/agentmemory mcp
```

---

## Next Steps

1. ✅ iii-engine installed and running
2. ✅ Full mode active (54 tools)
3. ✅ MCP config updated
4. ⏳ Add LLM API key for better summarization (optional)
5. ⏳ Enable consolidation for long-term memory (optional)
6. ⏳ Monitor snapshots in backup folder

---

## Credit

Binary iii-engine v0.11.2 dari [iii-hq/iii releases](https://github.com/iii-hq/iii/releases/tag/iii%2Fv0.11.2).
