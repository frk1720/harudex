# Agentmemory Cross-Device Sync Setup

## Status: ✅ Configured for OneDrive Sync

Sistem agentmemory sudah dikonfigurasi untuk auto-sync ke OneDrive agar bisa sync antar device (laptop kantor ↔ laptop rumah).

---

## Problem

Data agentmemory tidak sinkron antar device karena:
1. Daemon menyimpan data di `AppData\Roaming\agentmemory` (local per-device)
2. User hanya copy folder `.agentmemory` dari OneDrive (yang hanya berisi config)
3. Data sebenarnya tidak ter-backup

## Solution

Setup **auto-snapshot ke OneDrive** agar data memory tersinkronisasi antar device.

---

## Configuration

### 1. Snapshot Settings

Updated `.agentmemory/.env`:
```env
SNAPSHOT_ENABLED=true
SNAPSHOT_DIR=C:\Users\FSOS\OneDrive\agentmemory-snapshots
SNAPSHOT_INTERVAL=1800  # 30 minutes
```

### 2. Global Settings

Updated `C:\Users\FSOS\.agentmemory\.env`:
```env
SNAPSHOT_ENABLED=true
SNAPSHOT_DIR=C:\Users\FSOS\OneDrive\agentmemory-snapshots
SNAPSHOT_INTERVAL=1800  # 30 minutes
```

### 3. How It Works

1. **Daemon running** → Snapshot dibuat setiap 30 menit
2. **OneDrive sync** → File snapshot auto-upload ke cloud
3. **Di device lain** → Download snapshot dari OneDrive → restore

---

## Data Locations

### Database (Harus Di-backup)
```
C:\Users\FSOS\AppData\Roaming\agentmemory\state_store.db
C:\Users\FSOS\AppData\Roaming\agentmemory\stream_store\
```

### Auto-Snapshot (Recommended)
```
C:\Users\FSOS\OneDrive\agentmemory-snapshots\
```

---

## Workflow Sync Antar Device

### Dari Laptop Rumah ke Kantor:

1. **Di laptop rumah:**
   ```bash
   # Daemon sudah running, snapshot auto-created
   # Check status
   npx @agentmemory/agentmemory status
   ```

2. **OneDrive auto-sync** ke cloud

3. **Di laptop kantor:**
   ```bash
   # Download snapshot dari OneDrive
   # Stop daemon jika running
   taskkill /f /im iii.exe
   
   # Copy database
   xcopy "C:\Users\FSOS\OneDrive\agentmemory-snapshots\" "C:\Users\Kiki\AppData\Roaming\agentmemory\" /E /I /Y
   
   # Start daemon
   npx @agentmemory/agentmemory
   ```

### Dari Laptop Kantor ke Rumah:

1. **Di laptop kantor:**
   ```bash
   # Export snapshot manual jika perlu
   npx @agentmemory/agentmemory export --output backup.zip
   ```

2. **Upload ke OneDrive**

3. **Di laptop rumah:**
   ```bash
   # Download dan restore
   # (sama seperti di atas)
   ```

---

## Verification

### Check Daemon Status
```bash
npx @agentmemory/agentmemory status
```

**Expected output:**
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

### Check Snapshot Directory
```bash
dir C:\Users\FSOS\OneDrive\agentmemory-snapshots /s /b
```

**Expected:** Folder exists, will contain snapshot files after daemon runs.

---

## Files Changed

| File | Change |
|------|--------|
| `.agentmemory/.env` | Updated SNAPSHOT_DIR to OneDrive |
| `C:\Users\FSOS\.agentmemory\.env` | Updated SNAPSHOT_DIR to OneDrive |
| `BACKUP_RESTORE_GUIDE.md` | Created comprehensive backup guide |

---

## Next Steps

1. ✅ Auto-sync configured
2. ✅ Documentation created
3. ⏳ Restart daemon to apply new settings
4. ⏳ Test snapshot creation (wait 30 minutes or restart daemon)
5. ⏳ Test restore on other device

---

## Troubleshooting

### Snapshot Not Created
```bash
# Check if daemon is running
npx @agentmemory/agentmemory status

# Check snapshot directory
dir C:\Users\FSOS\OneDrive\agentmemory-snapshots

# Restart daemon
npx @agentmemory/agentmemory stop
npx @agentmemory/agentmemory
```

### OneDrive Sync Issues
- Check OneDrive status icon in system tray
- Ensure OneDrive is signed in and syncing
- Check available storage space

### Database Corruption
```bash
# Restore from latest snapshot
# Delete corrupted database
del "C:\Users\FSOS\AppData\Roaming\agentmemory\*.db"

# Extract snapshot
tar -xf "C:\Users\FSOS\OneDrive\agentmemory-snapshots\latest.tar.gz" -C "C:\Users\FSOS\AppData\Roaming\agentmemory"
```

---

## Contact

For issues with this setup:
- Check `BACKUP_RESTORE_GUIDE.md` for detailed instructions
- Review `INTEGRATION_AGENTMEMORY.md` for initial setup
- Check `III_ENGINE_INSTALLATION.md` for engine installation
