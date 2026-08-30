# OMP Project Template

Template ini membawa workflow engineering reusable ke project baru. Isinya adalah `AGENTS.md` sebagai kontrak project dan folder `skills/` sebagai workflow yang dipilih berdasarkan intent pekerjaan.

## Struktur

```text
omp-project-template/
├── AGENTS.md
├── skills/
│   ├── spec-driven-development/
│   ├── planning-and-task-breakdown/
│   ├── test-driven-development/
│   ├── debugging-and-error-recovery/
│   ├── code-review-and-quality/
│   ├── security-and-hardening/
│   └── shipping-and-launch/
└── docs/
    └── workflow.md
```

## Membuat project baru dari template

### Dengan GitHub template repository

1. Push isi folder ini ke repository GitHub.
2. Aktifkan **Template repository** pada pengaturan repository.
3. Pilih **Use this template** saat membuat project baru.
4. Sesuaikan `AGENTS.md` setelah repository dibuat.
5. Hapus atau ubah dokumentasi template yang tidak relevan dengan project baru.

### Dengan Git clone

```bash
git clone <template-repository-url> project-baru
cd project-baru
```

Setelah clone, buat remote project baru dan sesuaikan metadata Git sesuai workflow tim.

## Wajib disesuaikan pada project baru

`AGENTS.md` template menyediakan aturan reusable, bukan seluruh konfigurasi project. Tambahkan atau ubah bagian project-specific berikut:

- Bahasa, framework, dan package manager.
- Command focused test dan full test suite.
- Command build, typecheck, lint, format, dan dev.
- Lokasi source, test, migration, dan dokumentasi.
- Database, ORM, dan migration policy.
- Deployment platform, CI/CD, environment, dan rollback.
- Aturan dependency, auth, permission, dan data sensitif.
- Konvensi output atau bahasa tim jika berbeda.

Jangan mengganti routing skill atau Definition of Done tanpa memastikan lifecycle tetap lengkap.

## Cara kerja agent

Untuk pekerjaan non-trivial, agent mengikuti:

```text
DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP
```

Routing utama:

| Intent | Skill |
|---|---|
| Feature baru atau requirement ambigu | `spec-driven-development` |
| Memecah pekerjaan menjadi task | `planning-and-task-breakdown` |
| Mengubah behavior atau memperbaiki bug | `test-driven-development` |
| Test/build/runtime failure | `debugging-and-error-recovery` |
| Review sebelum merge | `code-review-and-quality` |
| Input, auth, PII, upload, webhook, external API | `security-and-hardening` |
| Release, deployment, migration, rollout | `shipping-and-launch` |

Jika beberapa kondisi berlaku, gunakan semua skill yang relevan secara berurutan atau gabungan. Skill memberi prosedur; OMP tetap menyediakan tool untuk membaca, mengedit, menjalankan command, menguji runtime, dan mendelegasikan pekerjaan.

## Konvensi pekerjaan

Untuk pekerjaan yang memerlukan planning, gunakan:

```text
tasks/plan.md
tasks/todo.md
```

File tersebut dibuat per project saat diperlukan dan tidak disimpan di template agar project baru dimulai tanpa task lama.

Untuk spec, ikuti konvensi project. Jika belum ada, gunakan nama seperti:

```text
SPEC-<feature>.md
```

## Update template

Perubahan workflow yang ingin berlaku untuk project baru harus dilakukan di repository template terlebih dahulu. Setelah itu:

1. Commit perubahan template.
2. Catat perubahan yang breaking terhadap perilaku agent.
3. Update project yang sudah dibuat dari template secara terencana.
4. Jangan mengubah skill project secara diam-diam jika project membutuhkan versi workflow yang stabil.

Template adalah snapshot saat project dibuat; project lama tidak otomatis menerima perubahan template.

## Checklist sebelum template dipakai

- [ ] `AGENTS.md` sudah memiliki command dan aturan project tujuan.
- [ ] Semua tujuh skill tersedia di `skills/`.
- [ ] Routing hanya merujuk skill yang tersedia atau menandai skill opsional dengan jelas.
- [ ] Definition of Done sesuai cara verifikasi project.
- [ ] Tidak ada spec, task list, secret, credential, atau data project asal.
- [ ] Project dapat menjalankan lifecycle minimal sampai `VERIFY`.
