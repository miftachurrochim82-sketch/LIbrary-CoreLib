# LIbrary-CoreLib

Library GAS backend global ekosistem aplikasi Pemkab Trenggalek. Satu library untuk auth SSO, role guard (RBAC fail-closed), engine database Google Sheets, CRUD generik, dan test suite — semua aplikasi satelit (`si-kompetensi`, `si-pelaporan`, `si-lahar`, `si-dokumen`, dst.) memakai CoreLib + `frontend-cdn` (UI).

> **Catatan sejarah**: sumber ini dulunya tinggal di folder `backend/` repo `frontend-cdn`. Dipindah ke repo ini pada 2026-09-19 (commit `frontend-cdn@2d5afab "Delete backend directory"`) agar library punya repo, changelog, dan tag versinya sendiri. Repo `frontend-cdn` kini hanya memuat CDN frontend + dokumentasi arsitektur.

---

## 📌 Identitas Library

| Item | Nilai |
|---|---|
| Nama | `CoreLib` (Global Backend Library Pemkab Trenggalek) |
| Script ID | `1GmeYflfMpRa1iTVgFHRD6K1DMoxc9OoKqpuucPJXgNZ9XBK06O7wgDkO` |
| Identifier di app | `CoreLib` |
| Runtime | Apps Script V8, timezone `Asia/Jakarta` |
| Versi kode saat ini | **v2.4.0 DRAFT** (2026-09-22) |
| Versi library tersimpan | **pin 15 = v2.3.0** (next: **pin 16 = v2.4.0**) |

Dokumen lengkap (changelog v2.0→v2.3.0, kontrak keamanan, publik API, prosedur rilis): **[`src/00_MIGRATION_v2.md`](src/00_MIGRATION_v2.md)** — itu master referensi; README ini hanya ringkasan.

---

## 🗂️ Struktur File

| File | Isi |
|---|---|
| `src/appsscript.json` | Manifest: runtime V8, timezone, oauth scopes |
| `src/01_CoreFoundation.gs` | Engine DB Sheets (physical row index, `toAlignedRow_`), cache ber-namespace + TTL, parser tanggal ISO-8601, util sadar-WIB (`todayIsoLocal_`, `dateKey10_`), util publik (`paginate_`, `matchSearch_`), helper SIMPEG, logger |
| `src/02_CoreGateway.gs` | Auth bridge SSO (tiket → token sesi HMAC), `checkAuth`, role guard (`requireRole_`, `levelOf_` fail-closed), `dispatchAction` + declarative resource router (RLS `ownerField`), whitelist config, **C4 `validateTransition_` + C5 `assertOwnership_` (v2.4.0)** |
| `src/03_CoreServices.gs` | CRUD generik (`apiSave`/`apiDelete`), config service, `executeAppSetup`, resolusi pegawai, **C8 tema dinamis `getThemeConfig_`/`buildThemeCss_` (v2.4.0)** |
| `src/99_CoreTest.gs` | Test suite diagnostik: `testAll()` (**46 test, PASS 45 + SKIP 1**), `runCoreTests(ctx)`, `cekUpdateCorelib()` |
| `src/00_MIGRATION_v2.md` | ★ Dokumen master (hanya di GitHub — GAS tidak bisa menyimpan `.md`) |
| `clasp.json` / `claspignore` | Tooling clasp; whitelist 5 file library yang boleh ter-push |

---

## 🚀 Cara Pakai (dari aplikasi konsumer)

1. Tambahkan library di `appsscript.json` app:
   ```json
   "dependencies": {
     "libraries": [
       {
         "libraryId": "1GmeYflfMpRa1iTVgFHRD6K1DMoxc9OoKqpuucPJXgNZ9XBK06O7wgDkO",
         "version": "15",
         "deploymentStatus": "CANONICAL"
       }
     ]
   }
   ```
   (Gunakan **pin versi eksplisit**, bukan `developmentMode`/`@main`.)
2. Panggil dengan prefix `CoreLib.` — contoh: `CoreLib.dispatchAction(payload, cfg)`, `CoreLib.apiSave(...)`, `CoreLib.todayIsoLocal()`, `CoreLib.paginate(list, page, per)`.

Template aplikasi baru: **[`starter-kit`](https://github.com/miftachurrochim82-sketch/starter-kit)** (jangan salin manual — cetak dari starter-kit yang sudah CoreLib-first).

---

## ✅ Test

| Fungsi | Hasil yang diharapkan |
|---|---|
| `testAll()` (di editor CoreLib) | `PASS: 45 / FAIL: 0 / SKIP: 1` |
| `runCoreTests(ctx)` dari app | Semua grup database PASS (butuh `ctx` lengkap) |

Setiap rilis wajib `FAIL: 0` + test regresi fail-closed (`testRoleGateV222`) + test v2.3.0 (`testTodayIsoLocalV230`, `testDateKey10V230`, `testPaginateV230`, `testMatchSearchV230`) + test v2.4.0 (`testAssertOwnershipV240`, `testValidateTransitionV240`, `testThemeConfigV240`).

---

## 🔒 Kontrak Utama (ringkasan — detail di `00_MIGRATION_v2.md` §7)

- **Fail-closed**: role tak dikenal / viewer = level 0; tidak boleh ada fallback `|| 1`.
- **Kolom audit** di-strip dari payload user — hanya diisi server.
- **`testMode` sudah dihapus** — tiket palsu selalu ditolak.
- **Sheet referensi SIMPEG read-only** — fungsi baca tidak boleh menulis.
- **Tanggal disimpan ISO-8601**; `todayIso()` = UTC (jangan dipakai untuk logika user) — pakai `todayIsoLocal()`/`dateKey10()`.

## 📦 Prosedur Rilis (ringkasan)

1. Ubah file di `src/` (workspace = sumber kebenaran).
2. Paste whole-file ke editor GAS CoreLib → jalankan `testAll()` → `FAIL: 0`.
3. Simpan versi library baru (nomor pin bertambah) → naikkan `"version"` di app yang pinned.
4. Push ke GitHub + tag versi (`v2.3.0`) → perbarui `00_MIGRATION_v2.md`.

> ⚠️ Urutan penting: **paste → test → save versi → bump pin → GitHub**. Jangan tag sebelum terverifikasi di GAS.
