# Panduan Library CoreLib v2.4.0 — Pemkab Trenggalek
### Satu Pondasi Backend untuk Semua Aplikasi (GAS + Sheets)

> **Repo ini = BACKEND SAJA.** Frontend CDN (Vue) hidup di repo terpisah **[frontend-cdn](https://github.com/miftachurrochim82-sketch/frontend-cdn)** (`@v2.9.0`, 10 file fisik). Dulunya backend sempat tinggal di `frontend-cdn/backend/`, kini **sudah pindah ke repo ini sejak 2026-09-19** (`frontend-cdn@2d5afab`). Panduan frontend ada di `frontend-cdn/ECOSYSTEM_GUIDE.md`.

---

## 1. Ringkasan & Prinsip

`CoreLib` adalah **satu library GAS** untuk semua aplikasi satelit (si-kompetensi, si-pelaporan, si-lahar, si-dokumen, app baru dari `starter-kit`). Semua DB Google Sheets, auth SSO, role guard, dan CRUD generik ditangani di sini — app satelit cukup konfigurasi.

**5 prinsip:**
1. **Single Source of Truth** — master SIMPEG di si-platform, app satelit baca langsung tanpa duplikasi.
2. **Physical Row (`_row`)** — update/delete pakai nomor baris fisik, bukan index filter.
3. **Fail-closed RBAC** — role tak dikenal = level 0, ditolak (bukan level 1).
4. **Sadar WIB** — `todayIsoLocal()`/`dateKey10()` (fix bug UTC `todayIso()` mundur 1 hari sebelum 07:00 WIB).
5. **CoreLib first** — util umur/durasi/tanggal wajib cek CoreLib dulu sebelum tulis lokal (kontrak C5).

---

## 2. Peta Ekosistem (fokus backend)

```text
┌────────────────────────────────────────┐
│  CoreLib v2.4.0 (repo ini)             │
│  ID 1GmeYflf... pin 17 LIVE PASS 47   │
│  DB Engine, SSO, RBAC, CRUD, Util      │
└──────────────────┬─────────────────────┘
                   │  Library import (appsscript.json)
      ┌────────────┴────────────┐
      ▼                         ▼
┌──────────────┐      ┌──────────────────┐
│ Aplikasi     │      │ si-platform      │
│ Satelit      │◄────►│ (SSO Provider    │
│ (GAS + CDN)  │ SSO  │  + Master SIMPEG)│
└──────────────┘      └──────────────────┘
      ▲                         ▲
      └───────────┬─────────────┘
                  ▼
        ┌──────────────────┐
        │ Google Sheets    │
        │ (per-app + master│
        │  SIMPEG)         │
        └──────────────────┘
```

Frontend CDN (`@v2.9.0`) = baju. CoreLib = pondasi.

---

## 3. Identitas Library

| Item | Nilai |
|---|---|
| Nama | `CoreLib` |
| Script ID | `1GmeYflfMpRa1iTVgFHRD6K1DMoxc9OoKqpuucPJXgNZ9XBK06O7wgDkO` |
| Identifier | `CoreLib` di app consumer |
| Runtime | Apps Script V8, timezone `Asia/Jakarta` |
| Versi LIVE | **v2.4.0 pin 17** (2026-09-23, `testAll()` PASS 47 / FAIL 0 / SKIP 1) |
| Versi sebelumnya | v2.3.0 pin 15, v2.2.3 pin 13, dst. (lihat `src/00_MIGRATION_v2.md`) |

Changelog lengkap ada di [`src/00_MIGRATION_v2.md`](src/00_MIGRATION_v2.md) — itu master referensi.

---

## 4. Struktur File

| File | Isi |
|---|---|
| `src/appsscript.json` | Manifest V8, timezone, scopes, `dependencies` |
| `src/01_CoreFoundation.gs` | Engine Sheets (`getDb`, `ensureSheet`, `toAlignedRow_`, `_row`), SIMPEG, logger, **C6** `periodeBulan`/`dalamPeriode`/`hitungHariKerja`, **C7** `findUnique`/`upsertUnique` |
| `src/02_CoreGateway.gs` | SSO HMAC ticket 5 menit, `checkAuth`, `levelOf_` (fail-closed), `requireRole_`, `declareResourceRouter`, **C4** `validateTransition_`, **C5** `assertOwnership_` |
| `src/03_CoreServices.gs` | CRUD generik (`apiFind`, `apiSave`, `apiRemove`), `paginate_`, `matchSearch_`, `todayIsoLocal`/`dateKey10`, **C8** `getThemeConfig_`/`buildThemeCss_` |
| `src/99_CoreTest.gs` | Suite `testAll()` — 48 test (47 PASS + 1 SKIP `TEST_SPREADSHEET_ID_B`) |
| `src/00_MIGRATION_v2.md` | ★ Dokumen master changelog & kontrak (hanya di GitHub) |
| `clasp.json` / `.claspignore` | Whitelist 5 file yang boleh push ke GAS |

---

## 5. Auth & RBAC

- **SSO:** `si-platform` jadi IdP, app satelit validasi tiket HMAC via `CoreLib.checkAuth()`. Tiket 5 menit, `fail-closed` jika `lv === undefined`.
- **Role:** `levelOf_(role)` → `admin=3, operator=2, viewer=1, unknown=0`. Gerbang `requireRole_` cek level, bukan string.
- **Owner guard:** `assertOwnership_(row, userId, ownerField)` — untuk scope “Saya” vs “Semua” (C5).

---

## 6. Database & CRUD

- **Sheets sebagai DB** — tiap resource = 1 sheet, header baris 1, data mulai baris 2, kolom dipetakan dinamis.
- **Kunci:** `pkFields` (unik), `genUniqueCode_` (format `TRG-YYYYMMDD-XXXX`).
- **Operasi:** `apiFind` (paginate + search), `apiSave` (insert/update), `apiRemove` (soft-delete filter otomatis), `upsertUnique` (C7 — cegah duplikat).
- **App baru:** pakai `starter-kit` → isi `getAppConfig_()` (`appCode`, `headersMap`, `pkFields`, `localHandlers`) → `CoreLib.dispatchAction(payload, cfg)` handle sisanya.

---

## 7. Util Baru v2.4.0 (C4–C8)

| Grup | Fungsi | Pakai untuk |
|---|---|---|
| **C4** | `validateTransition(oldSt, newSt, map)` | Workflow: tolak transisi status ilegal (draft→selesai) |
| **C5** | `assertOwnership(row, userId, field)` | Scope “Saya”: pastikan row milik user |
| **C6** | `periodeBulan(tahun, bulan)`, `dalamPeriode(tgl, p)`, `hitungHariKerja(p)` | Laporan piramida 12-8-6-4 (bulanan, potong weekend) |
| **C7** | `findUnique(sheet, kode, col)`, `upsertUnique(...)` | Cegah dobel kode unik |
| **C8** | `getThemeConfig(sheetConfig)`, `buildThemeCss(code)` | Tema per-app (simpan di sheet CONFIG) |

Semua **aditif murni** — tidak ubah `apiSave`/`checkAuth`/`toAlignedRow_` lama.

---

## 8. WIB & Helper

- **WIB benar:** `todayIsoLocal()` = `Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd')`, `dateKey10(d)` → `yyyy-MM-dd`. Jangan pakai `todayIso()` UTC lama.
- **Paginate:** `paginate(rows, page, limit)` → `{items, total, page, limit, totalPages}`
- **Search:** `matchSearch(row, q, fields)` → substring case-insensitive.

---

## 9. Test & Rilis

```js
// di editor GAS library
testAll() // → PASS 47 / FAIL 0 / SKIP 1 (butuh TEST_SPREADSHEET_ID_B untuk 1 test cache)
```

**Rilis:**
1. `clasp push` dari `src/` (hanya 5 file whitelist).
2. Di GAS → **Deploy → New version** → catat nomor (mis. 17).
3. Update `src/00_MIGRATION_v2.md` (Live terakhir, Verifikasi).
4. `git tag -a v2.4.0 -m "v2.4.0 pin17"` → `git push --tags`.
5. App satelit bump `appsscript.json` `version: "17"`.

---

## 10. Hubungan dengan Frontend

Butuh UI? Lihat **[frontend-cdn](https://github.com/miftachurrochim82-sketch/frontend-cdn)**:
- Guide frontend: `frontend-cdn/ECOSYSTEM_GUIDE.md`
- Snippet: `frontend-cdn/frontend/CDN_SNIPPET.md`
- Katalog: `frontend-cdn/frontend/README.md`

Cetak app baru dari **[starter-kit](https://github.com/miftachurrochim82-sketch/starter-kit)** (sudah wiring `CoreLib` pin 17 + CDN `@v2.9.0`).

---

## 11. Riwayat Versi (backend saja)

| Versi | Pin | Inti |
|---|---|---|
| **v2.4.0** | **17** | C4-C8 (workflow, periode, unique, theme) — PASS 47 |
| v2.3.0 | 15 | `todayIsoLocal`, `dateKey10`, `paginate`, `matchSearch` |
| v2.2.3 | 13 | Fix `levelOf_` fail-closed |
| v2.2.2 | 12 | Fix `checkAuth`, `dispatchAction` |

Lengkap di `src/00_MIGRATION_v2.md`.
