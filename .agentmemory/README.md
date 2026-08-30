# Agentmemory Configuration untuk HaruDex

Konfigurasi ini menghubungkan projek HaruDex dengan sistem agentmemory dari `C:\Users\FSOS\OneDrive\GITHUB\.agentmemory`.

## Struktur File

```
.agentmemory/
├── preferences.json       # Konfigurasi agentmemory (dari .agentmemory global)
├── .env                  # Environment variables untuk agentmemory
└── *.sqlite              # Database files (auto-generated, di-gitignore)
```

## Cara Menggunakan

### 1. Start Agentmemory Daemon

```bash
npx @agentmemory/agentmemory
```

Ini akan menjalankan daemon di `http://localhost:3111` dengan konfigurasi dari `.env`.

### 2. Menggunakan MCP Client

Agentmemory akan otomatis terintegrasi dengan MCP (Model Context Protocol) jika client mendukungnya. Konfigurasi MCP sudah ada di `.mcp.json`.

### 3. Fitur yang Aktif

Berdasarkan konfigurasi `.env`:
- **Embedding Provider**: Local (Xenova/all-MiniLM-L6-v2) - tidak perlu API key
- **Graph Extraction**: Enabled - meningkatkan recall memory
- **Context Injection**: Enabled - otomatis inject memory ke agent prompts
- **Snapshots**: Setiap 30 menit ke `C:\Users\FSOS\OneDrive\agentmemory-snapshots-harudex`

### 4. Kustomisasi

Edit `.agentmemory/.env` untuk:
- Menambahkan LLM provider (OpenAI, Anthropic, dll.)
- Mengubah port default (3111)
- Mengatur snapshot interval
- Mengaktifkan fitur consolidation atau auto-compress

### 5. Monitoring

Cek status daemon:
```bash
npx @agentmemory/agentmemory status
```

Lihat snapshot di:
```
C:\Users\FSOS\OneDrive\agentmemory-snapshots-harudex
```

## Integrasi dengan Workflow

Agentmemory akan otomatis:
1. **Menyimpan observations** saat agent bekerja
2. **Menghubungkan konsep** melalui graph extraction
3. **Menginject context** saat agent membutuhkan informasi sebelumnya
4. **Membuat snapshot** untuk backup dan analisis

## Troubleshooting

### Daemon tidak start
```bash
# Cek port yang digunakan
netstat -ano | findstr 3111

# Cek log error
npx @agentmemory/agentmemory 2>&1
```

### MCP tidak terhubung
```bash
# Cek konfigurasi MCP
type .mcp.json

# Restart daemon
taskkill /f /im iii.exe 2>nul
npx @agentmemory/agentmemory
```

### Database corrupt
```bash
# Hapus database dan restart
del .agentmemory\*.sqlite
npx @agentmemory/agentmemory
```

## Catatan

- File `.env` di `.agentmemory/` tidak di-commit ke git (ada di `.gitignore`)
- Database sqlite juga di-gitignore
- Snapshot disimpan terpisah untuk keamanan
- Konfigurasi ini bersifat local dan tidak akan ter-commit
