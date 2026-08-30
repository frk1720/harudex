# Pandian Backup & Restore Agentmemory untuk Cross-Device Sync

## Overview

Agentmemory menyimpan data di **AppData\Roaming**, bukan di folder `.agentmemory` yang ada di OneDrive. Untuk sync antar device (laptop kantor ↔ laptop rumah), gunakan panduan ini.

---

## Lokasi Data Penting

### 1. Database Utama (Harus Di-backup)
```
C:\Users\FSOS\AppData\Roaming\agentmemory\state_store.db
C:\Users\FSOS\AppData\Roaming\agentmemory\stream_store\
```

**Apa isinya:**
- `state_store.db` - Semua memories, lessons, crystals, graph nodes
- `stream_store/` - Raw observations dari setiap session

### 2. Snapshot Auto (Recommended)
```
C:\Users\FSOS\OneDrive\agentmemory-snapshots\
```

Dibuat otomatis setiap 30 menit saat daemon running.

### 3. Konfigurasi (Opsional)
```
C:\Users\FSOS\.local\bin\iii.exe          # Binary iii-engine
C:\Users\FSOS\.agentmemory\preferences.json   # Preferensi agent
C:\Users\FSOS\.agentmemory\.env            # Environment variables
```

---

## Backup Guide

### Opsi A: Auto-Snapshot via Daemon (RECOMMENDED) ✅

Dengan konfigurasi saat ini:
- Snapshot dibuat setiap **30 menit** (1800 detik)
- Lokasi: `C:\Users\FSOS\OneDrive\agentmemory-snapshots\`
- Format: JSON export + database dump

**Cara kerja:**
1. Start daemon: `npx @agentmemory/agentmemory`
2. Daemon auto-create snapshot ke OneDrive tiap 30 menit
3. OneDrive auto-sync ke cloud
4. Di device lain, download OneDrive → restore

**Keuntungan:**
- ✅ Otomatis tanpa intervensi
- ✅ Terintegrasi dengan workflow normal
- ✅ Version history via OneDrive

**Limitasi:**
- ⚠️ Harus start daemon agar snapshot dibuat

### Opsi B: Manual Export via CLI

Jika daemon tidak jalan atau ingin on-demand backup:

```bash
cd C:\Users\FSOS\.agentmemory

# Export data ke file zip
npx @agentmemory/agentmemory export --output backup_$(date).zip

# Atau langsung copy manual
xcopy "C:\Users\FSOS\AppData\Roaming\agentmemory" "C:\Backup\agentmemory" /E /I /Y
```

**Manfaat:**
- ✅ Bisa dilakukan kapan saja
- ✅ Tidak perlu start daemon
- ✅ Full control atas waktu backup

---

## Restore Guide

### Scenario 1: Setup di Device Baru (Laptop Kantor)

```bash
# Step 1: Stop semua daemon agentmemory
# Jika ada, kill proses III engine

# Step 2: Copy database dari backup
xcopy "C:\Users\FSOS\OneDrive\agentmemory-snapshots\" "C:\Users\Kiki\AppData\Roaming\agentmemory\" /E /I /Y

# Step 3: Pastikan struktur folder ada
mkdir "C:\Users\Kiki\AppData\Roaming\agentmemory"
copy "backup_files_here" "C:\Users\Kiki\AppData\Roaming\agentmemory\"

# Step 4: Start daemon
npx @agentmemory/agentmemory

# Step 5: Verify
npx @agentmemory/agentmemory status
```

### Scenario 2: Restore dari Backup File

```bash
# Extract backup file
tar -xf agentmemory_backup.zip -C C:\Temp\restore

# Copy ke AppData
robocopy "C:\Temp\restore" "C:\Users\Kiki\AppData\Roaming\agentmemory" /E /COPY:DAT /R:3 /W:5

# Start daemon
npx @agentmemory/agentmemory
```

---

## Troubleshooting

### Error: Database Locked
**Problem:** Daemon masih jalan saat restore

**Solution:**
```bash
# 1. Stop daemon
taskkill /f /im iii.exe

# 2. Restore database
# (lakukan copy)

# 3. Start ulang
npx @agentmemory/agentmemory
```

### Error: Permission Denied
**Problem:** Tidak punya akses ke AppData

**Solution:**
```powershell
# Run as administrator
# Atau ubah permissions folder
icacls "C:\Users\FSOS\AppData\Roaming\agentmemory" /grant Users:F /T
```

### Error: Schema Version Mismatch
**Problem:** Database versi lama terlalu usang

**Solution:**
```bash
# Import dari snapshot terbaru (lebih reliable daripada copy direct db)
# Delete old database
del "C:\Users\FSOS\AppData\Roaming\agentmemory\*.db"

# Extract fresh snapshot
tar -xf agentmemory-snapshot-latest.tar.gz -C "C:\Users\FSOS\AppData\Roaming\agentmemory"
```

---

## Checklist Sync Antar Device

### Dari Laptop Rumah ke Kantor:

```
[ ] OneDrive sudah up-to-date
[ ] Download latest snapshot dari agentmemory-snapshots/
[ ] Di laptop kantor: stop semua agentmemory process
[ ] Copy state_store.db & stream_store/ ke AppData/Roaming
[ ] Start daemon: npx @agentmemory/agentmemory
[ ] Verify: npx @agentmemory/agentmemory status
[ ] Check viewer: http://localhost:3113
```

### Dari Laptop Kantor ke Rumah:

```
[ ] Copy database dari kantor ke OneDrive
[ ] Update snapshot directory setting jika beda location
[ ] Restart daemon di laptop rumah
[ ] Verify data tersinkronisasi
```

---

## Best Practices

### 1. Backup Rutin
```bash
# Buat script backup sederhana
@echo off
xcopy "C:\Users\FSOS\AppData\Roaming\agentmemory" "D:\Backup\agentmemory\%date%" /E /I /Y
```

### 2. Gunakan Snapshots
- Biarkan daemon running saat work
- Snapshot auto-dibuat tiap 30 menit
- OneDrive auto-sync

### 3. Test Restore
- Periodically test restore ke temporary folder
- Verifikasi database integrity

### 4. Document Changes
Catat perubahan penting:
```text
Date: 2026-08-24
Backup: Created from home laptop
Changes: Started working on HaruDex auth flow
Snapshot: Latest at C:\Users\FSOS\OneDrive\agentmemory-snapshots\
```

---

## Monitoring Status

### Check Uptime & Health
```bash
npx @agentmemory/agentmemory status
```

### Check Memory Count
```bash
curl http://localhost:3113/api/metrics/memory-count
```

### View Snapshot Directory
```bash
dir C:\Users\FSOS\OneDrive\agentmemory-snapshots /s /b
```

---

## Quick Reference

| Action | Command | Output Location |
|--------|---------|-----------------|
| Backup auto (daemon) | Run `npx @agentmemory/agentmemory` | OneDrive/snapshots |
| Backup manual | `xcopy ...\AppData\Roaming\agentmemory ...` | Anywhere you want |
| Export via CLI | `npx @agentmemory/agentmemory export` | Current dir |
| Status check | `npx @agentmemory/agentmemory status` | Terminal |
| Viewer | Open http://localhost:3113 | Browser |

---

## Files to Always Backup

1. ✅ `C:\Users\FSOS\AppData\Roaming\agentmemory\state_store.db`
2. ✅ `C:\Users\FSOS\AppData\Roaming\agentmemory\stream_store\`
3. ✅ `C:\Users\FSOS\.agentmemory\preferences.json` (if customized)
4. ✅ All files in `C:\Users\FSOS\OneDrive\agentmemory-snapshots\`

**Note:** Folder `.agentmemory` di project root (harudex-seacucumber/.agentmemory/) HANYA konfigurasi lokal, TIDAK berisi data memory.

---

## Contact & Support

For agentmemory issues:
- Docs: https://docs.mcp.agentmemory.dev
- GitHub: https://github.com/ahhmm/agentmemory
- Issues: https://github.com/ahhmm/agentmemory/issues

---

## Version Info

- agentmemory version: v0.9.29
- iii-engine version: 0.11.2
- Configuration date: 2026-08-24
