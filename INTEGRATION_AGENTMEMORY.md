# Integration: Agentmemory with HaruDex Project

## Status: ✅ Connected and Working

HaruDex project sudah terhubung dengan sistem `agentmemory` melalui MCP (Model Context Protocol) connection.

---

## Apa yang Dilakukan

### 1. Setup File Konfigurasi

Dibuat file-file berikut di `.agentmemory/`:

- **`.agentmemory/preferences.json`** - Preferensi dari global .agentmemory
- **`.agentmemory/.env`** - Environment variables untuk agentmemory (local mode)
- **`.agentmemory/README.md`** - Dokumentasi penggunaan

### 2. Setup MCP Connection

File **`.mcp.json`** berisi konfigurasi MCP agar agent bisa mengakses agentmemory tools:

```jsonc
{
  "mcpServers": {
    "agentmemory": {
      "command": "npx",
      "args": ["--yes", "@agentmemory/agentmemory", "mcp"],
      "env": {
        "AGENTMEMORY_INJECT_CONTEXT": "true",
        "GRAPH_EXTRACTION_ENABLED": "true",
        "EMBEDDING_PROVIDER": "local",
        "STANDALONE_MCP": "1"
      }
    }
  }
}
```

### 3. Updated .gitignore

Menambahkan exclusions untuk database files dari agentmemory:

```
!.agentmemory/.env        # Keep config
.agentmemory/preferences.json   # Keep preferences
.agentmemory/*.sqlite       # Exclude database files
.agentmemory/snapshots      # Exclude snapshot directory
```

---

## Mode Standalone vs Full Daemon

### ⚠️ Penting: Mode Standalone Dipakai Saat Ini

Karena Windows tidak mendukung auto-instal iii-engine secara otomatis, kita menggunakan **standalone MCP mode**:

**Keuntungan:**
- Tidak perlu install iii-engine
- Langsung berfungsi dengan MCP
- Tools dasar tersedia (7 of 54 tools)

**Limitasi:**
- Hanya 7 tools aktif (bukan 54)
- Graph extraction terbatas pada local storage
- Tidak ada konsolidasi otomatis

### Jika Ingin Full Mode (Opsional)

Untuk menggunakan full daemon dengan semua 54 tools:

1. Download iii-engine v0.11.2:
   ```
   https://github.com/iii-hq/iii/releases/download/iii/v0.11.2/iii-x86_64-pc-windows-msvc.zip
   ```

2. Extract ke PATH (misal: `%USERPROFILE%\.local\bin\iii.exe`)

3. Start daemon:
   ```bash
   npx @agentmemory/agentmemory
   ```

4. Update AGENTMEMORY_URL di `.env` jika perlu

---

## Fitur yang Aktif

Berdasarkan konfigurasi:

| Fitur | Status | Keterangan |
|-------|--------|------------|
| Embedding Provider | ✅ Local | Xenova/all-MiniLM-L6-v2 (offline, gratis) |
| Graph Extraction | ✅ Enabled | Ekstraksi konsep dari memories |
| Context Injection | ✅ Enabled | Inject memory ke agent prompts |
| Standalone MCP | ✅ Active | Mode tanpa full engine |
| Snapshots | ⚠️ Configured | Setiap 30 menit (butuh full daemon) |

---

## Tools yang Tersedia (Standalone Mode)

Dari test sebelumnya, tools berikut aktif:

1. **memory_recall** - Cari knowledge dari sesi sebelumnya
2. **memory_save** - Simpan context penting explicit
3. Dan beberapa tools lainnya (total 7 of 54)

---

## Cara Menggunakan

### Untuk MCP Client Support

Jika Anda menggunakan MCP-capable IDE/agent (VS Code + Coderabbit, Cursor, dll.), agentmemory akan otomatis aktif saat Anda melakukan task yang membutuhkan recall atau context injection.

### Manual Testing

Test tools agentmemory:

```bash
# List available tools
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npx --yes @agentmemory/agentmemory mcp

# Test memory save
echo '{"jsonrpc": "2.0", "id": 2, "method": "memory/save", "params": {"context": {"type": "session", "summary": "Started working on HaruDex auth flow"}}}' | npx --yes @agentmemory/agentmemory mcp

# Test memory recall
echo '{"jsonrpc": "2.0", "id": 3, "method": "memory/recall", "params": {"query": "HaruDex authentication workflow", "limit": 5}}' | npx --yes @agentmemory/agentmemory mcp
```

---

## Konfigurasi Lokal vs Global

Konfigurasi ini berasal dari global agentmemory di:
```
C:\Users\FSOS\OneDrive\GITHUB\.agentmemory\
```

Tapi menggunakan local overrides di:
```
C:\Users\FSOS\OneDrive\harudex-seacucumber\.agentmemory\
```

Ini memungkinkan Anda punya konfigurasi berbeda per project jika mau.

---

## Troubleshooting

### MCP Connection Error
```bash
# Restart MCP server
npx --yes @agentmemory/agentmemory mcp
```

### Tools Tidak Terload
```bash
# Cek konfigurasi MCP
type .mcp.json

# Pastikan AGENTMEMORY_INJECT_CONTEXT=true
```

### Need All 54 Tools
- Install iii-engine (lihat bagian "Mode Standalone vs Full Daemon")
- Atau gunakan Docker

---

## Next Steps

1. ✅ Basic integration done
2. ⏳ Optional: Add LLM API key for better summarization
3. ⏳ Optional: Install full iii-engine for all 54 tools
4. ⏳ Test memory recall after coding sessions
5. ⏳ Monitor snapshots in backup folder

---

## Files Changed

| File | Purpose | Git |
|------|---------|-----|
| `.agentmemory/preferences.json` | Agentmemory preferences | ✅ Kept |
| `.agentmemory/.env` | Environment configuration | ❌ Ignored |
| `.agentmemory/README.md` | Documentation | ✅ Recommended |
| `.mcp.json` | MCP server configuration | ✅ Kept |
| `.gitignore` | Added agentmemory exclusions | ✅ Commit |

---

## Credit & Attribution

Agentmemory system created by [Rohit](https://github.com/RahulKumar23). Documentation adapted from original [.agentmemory](C:\Users\FSOS\OneDrive\GITHUB\.agentmemory) setup.

For more info:
- Docs: https://docs.mcp.agentmemory.dev
- GitHub: https://github.com/ahhmm/agentmemory
