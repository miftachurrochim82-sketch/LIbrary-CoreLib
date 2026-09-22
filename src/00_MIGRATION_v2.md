# 📖 Dokumen Master CoreLib — Backend Global v2.4.0 DRAFT

> **Dokumen ini adalah master referensi backend CoreLib.** Disimpan hanya di GitHub
> (Google Apps Script tidak bisa menyimpan file `.md`). Folder `backend/` di repo ini
> adalah **salinan sumber resmi** dari library GAS `CoreLib` — setiap perubahan pada
> library harus dicerminkan di sini, dan sebaliknya.
>
> **Status terakhir**: **v2.4.0 DRAFT** (2026-09-22) — belum save versi — target `testAll()` → PASS 45 / FAIL 0 / SKIP 1.
> **Live terakhir**: v2.3.0 (2026-09-19, pin 15).

---

## 1. Identitas Library

| Item | Nilai |
|---|---|
| Nama | `CoreLib` (Global Backend Library Pemkab Trenggalek) |
| Script ID | `1GmeYflfMpRa1iTVgFHRD6K1DMoxc9OoKqpuucPJXgNZ9XBK06O7wgDkO` |
| Identifier di app | `CoreLib` |
| Runtime | Apps Script V8, timezone `Asia/Jakarta` |
| Versi kode saat ini | **v2.4.0 DRAFT** (2026-09-22) |
| Versi library tersimpan | **15 = v2.3.0** (live) → next **16 = v2.4.0** (draft, belum save) |

### Aplikasi konsumen

| Aplikasi | Pin di `appsscript.json` | `developmentMode` | Efek |
|---|---|---|---|
| `si-kompetensi` | `"version": "12"` | `true` | Selalu pakai kode HEAD terbaru → otomatis dapat v2.3.0 |
| `si-pelaporan` | `"version": "13"` | *(tidak ada)* | Terkunci di v13 = **v2.2.3** (belum bump) |
| `si-lahar` | `"version": "15"` | *(tidak ada)* | Terkunci di v15 = **v2.3.0** ✅ (pin dinaikkan 2026-09-19) |
| `si-platform` | — | — | Tidak memakai CoreLib (portal SSO mandiri) |

---

## 2. Struktur File

### Yang WAJIB ada di proyek GAS CoreLib (hanya 5 file ini)

| File | Isi |
|---|---|
| `appsscript.json` | Manifest: runtime V8, timezone, oauth scopes |
| `01_CoreFoundation.gs` | Engine database Google Sheets (physical row index, `toAlignedRow_`), caching ber-namespace + TTL, parser tanggal ISO-8601, **§7b util tanggal sadar-WIB (`todayIsoLocal_`, `dateKey10_`)**, **§11b util publik v2.3.0 (`paginate_`, `matchSearch_`)**, helper SIMPEG (level jabatan, unit bawahan), logger |
| `02_CoreGateway.gs` | Auth bridge SSO (tiket → token sesi HMAC), `checkAuth`, role guard (`requireRole_`, `getRoleForEmail_`, `levelOf_`), `dispatchAction` + declarative resource router, whitelist config, **§5b v2.4.0 `validateTransition_` + `assertOwnership_`** |
| `03_CoreServices.gs` | Layanan siap pakai: CRUD generik (`apiSave`/`apiDelete`), config service, `executeAppSetup` (pembuatan sheet + folder Drive), resolusi pegawai, **§3b v2.4.0 tema dinamis `getThemeConfig_`/`buildThemeCss_`** |
| `99_CoreTest.gs` | Test suite diagnostik: `testAll()` (**46 test total, PASS 45 + SKIP 1**), `runCoreTests(ctx)`, `cekUpdateCorelib()` |

### Yang HANYA ada di GitHub (JANGAN dimasukkan ke GAS CoreLib)

| File | Alasan |
|---|---|
| `00_MIGRATION_v2.md` | Dokumentasi — GAS tidak bisa menyimpan `.md` |
| ~~`Code.gs`~~ | **DIHAPUS 2026-09-17** — digantikan starter-kit. Dulu: template kerangka aplikasi baru (doGet, handleAction, runSetup, getAppConfig_) — untuk aplikasi KONSUMEN, bukan bagian library. CoreLib tidak punya `Index.html`, jadi `doGet` di sana akan error. Pakai file ini saat membuat aplikasi ke-4 dan seterusnya. |
| `.clasp.json` / `.claspignore` | Konfigurasi tooling clasp. `.claspignore` hanya memutihkan 5 file library — `Code.gs` sengaja di-exclude agar tidak pernah ter-push ke library. |

---

## 3. Changelog Lengkap

### v2.0 — Fondasi
| Kode | Kategori | Perubahan |
|---|---|---|
| C1 | Database | Update/soft-delete/hard-delete memakai **nomor baris fisik** (`_row`), bukan indeks array terfilter → mencegah penimpaan baris lain |
| C2 | Database | Penulisan selalu diselaraskan kolom fisik via `toAlignedRow_` → urutan kolom sheet fleksibel, kolom ekstra aman |
| C3 | Cache | Namespace per database (`sheetData_{dbId}_{sheetName}`), TTL maksimal 21.600 detik (6 jam) |
| H1 | Primary Key | `getRecordPrimaryId_` dukung `pkField` eksplisit + deteksi otomatis kolom `*_id` |
| H3 | Master SIMPEG | Fungsi baca **dilarang** membuat sheet referensi lokal; `PEGAWAI`/`JABATAN`/`UNIT_KERJA` selalu dibaca dari `MASTER_SPREADSHEET_ID` |
| H4 | Tanggal | Format kanonik ISO `YYYY-MM-DDTHH:mm:ss.sssZ` di sheet; `dd/MM/yyyy` hanya untuk tampilan |
| H5 | Strict Update | `undefined` = pertahankan nilai lama; `null`/`""` = kosongkan sel |
| M2 | Audit Trail | Kolom `created_at/by`, `updated_at/by`, `deleted_at` otomatis dipastikan di semua sheet non-referensi |

### v2.1
Role levels (`levelOf_` peta admin>verifikator>user>viewer), utilitas tanggal, `getLevelJabatan`, `getUnitBawahan`, penanganan *action not found* & *session expired* yang terstandar.

### v2.2
Util & keamanan baru: `normId_`, `parseDate_`, whitelist `isAllowedConfigKey_`, `validateFields_`, `genUniqueCode_`, `requireRole_`, `checkRole_`, `getRoleForEmail_` (whitelist `ADMIN_EMAILS`/`VERIFIKATOR_EMAILS` — **sengaja tanpa default** demi keamanan), declarative resource router (`save_<sheet>`, `get_<sheet>_list`, `get_<sheet>_detail`, `delete_<sheet>` otomatis).

### v2.2.1 (2026-09-15)
FIX `genUniqueCode_`: regex `reAnyNumber` yang buggy diganti — pembuatan kode unik tidak lagi salah deteksi angka.

### v2.2.2 (2026-09-15)
- FIX `checkAuth`: fallback role `=== undefined → 0` (fail-closed).
- FIX `dispatchAction`: membuang `data._cacheBust` sebelum diproses (kontrak app-core).
- Penguatan `requireRole_`.
- Menambah test regresi `testRoleGateV222`.
- ⚠️ **Insiden**: versi ini mengirim *test*-nya tetapi **tidak** *fix* `levelOf_`-nya → `testRoleGateV222` gagal diam-diam di live sejak 2026-09-15. Diperbaiki di v2.2.3.

### v2.2.3 (2026-09-16) — FIX KEAMANAN ⭐
```javascript
// SEBELUM (buggy): viewer (level 0) & role tak dikenal terangkat jadi level 1,
// lolos 9 gerbang akses level 'user'.
return (map && map[role]) || 1;

// SESUDAH (fail-closed):
var lv = map && map[String(role).toLowerCase()];
return lv === undefined ? 0 : lv;
```
Verifikasi live 2026-09-16: `testAll()` → **PASS 38 / FAIL 0 / SKIP 1**, termasuk `[PASS] testRoleGateV222`.

### v2.2.4 (2026-09-16/17) — Aditif (C1 ROADMAP Batch 3)
- ADD: `ensureSheet` menerima `options.decorate {bg, font, bold, frozen}` — kosmetik header aditif; perilaku default **tidak berubah** (si-pelaporan pin v13 aman).
- ADD (dipakai app Batch 3, bukan publik): `CoreLib.getDb`/`masterDbFor_`, delegasi per-sheet `initDatabase` via `ensureSheet`.
- Verifikasi live 2026-09-17: `testAll()` → PASS 38 / FAIL 0 / SKIP 1. Versi library tersimpan = **14**.

### v2.3.0 (2026-09-19) — Util Sadar-WIB & Publik (C1/C2/C3) ⭐
Aditif murni — util baru, tanpa perubahan perilaku lama.

| Kode | Fungsi Publik | Internal | Deskripsi |
|---|---|---|---|
| **C3** ⭐ | `todayIsoLocal()` | `todayIsoLocal_()` | Tanggal hari ini `yyyy-MM-dd` menurut **zona waktu Script (Asia/Jakarta)**. **Fix bug UTC vs WIB** pada `todayIso()` lama yang mundur 1 hari untuk user WIB sebelum 07:00. |
| **C3** | `dateKey10(val)` | `dateKey10_(val)` | Kunci tanggal `yyyy-MM-dd` sadar zona waktu Script. Menangani Date object, ISO penuh, legacy `dd/MM/yyyy`, dan `yyyy-MM-dd HH:mm`. Cermin helper lokal `tanggalKey10_` (si-lahar, fix G12) + **fix 3 bug laten** di si-kompetensi (`04_Diklat:347`, `07_Rencana:324/384`). |
| **C1** | `paginate(rows, page, limit)` | `paginate_()` | Potong array untuk paginasi server-side. Return `{ success, data, meta: {total, page, limit, total_pages} }`. Cermin `paginate_` (si-lahar `02_AppLogic`). |
| **C2** | `matchSearch(row, q, fields)` | `matchSearch_()` | Cek substring case-insensitive pada beberapa field. `q` kosong → true. `fields` kosong/null → false (cermin si-lahar). |

**Backward-compat**: `todayIso()` **TIDAK DIUBAH** — app lama tetap memakainya.

**Semantic `matchSearch_`** (cermin setia si-lahar):

| Input | Output | Alasan |
|---|---|---|
| `q = ''` / `null` | `true` | Tidak ada filter → semua lolos |
| `q = 'teks'`, `fields = null/[]` | `false` | Filter ada, tapi tidak ada field → tidak match |
| `q = 'teks'`, `fields = [...]` | `true`/`false` | Cek substring case-insensitive |

Verifikasi live 2026-09-19: `testAll()` → **PASS 42 / FAIL 0 / SKIP 1**. Versi library tersimpan = **15**.

### v2.4.0 DRAFT (2026-09-22) — Workflow + Ownership + Tema ⭐ — **BELUM SAVE, REVIEW ONLY**

Aditif murni — 3 util baru untuk 5 app (menu "Saya" + tema dinamis). Tanpa perubahan perilaku lama.

| Kode | Fungsi Publik | Internal | Deskripsi |
|---|---|---|---|
| **C5** | `assertOwnership(actor, ownerId, opts)` | `assertOwnership_()` + `checkOwnership_()` | Guard kepemilikan baris: `actor.pegawai_id === ownerId` atau admin/super bypass. `opts.allowAdminBypass` (default true). Throw `Anda hanya boleh mengelola data milik sendiri.` bila bukan pemilik. Untuk menu "Saya" di luar declarative router (manual `apiSave`). |
| **C4** | `validateTransition(cur, tgt, map, isAdmin)` | `validateTransition_()` | Validasi perpindahan status workflow case-insensitive. `isAdmin=true` → bypass. Map mis. `{draft:['baru','batal'], baru:['diproses','batal'], diproses:['selesai','batal']}`. Throw `Transisi "draft → selesai" tidak diizinkan.` |
| **C8** | `getThemeConfig(store)` | `getThemeConfig_()` | Baca tema dari `ScriptProperties`: `THEME_JSON` (JSON custom atau code) → `THEME_CODE` legacy → `emerald` default. Return objek tema lengkap `{code, primary, primaryDark, ...}` cermin `AppCore.themes` (6 preset). |
| **C8** | `buildThemeCss(theme)` + `getThemeCss(store)` | `buildThemeCss_()` / `getThemeCss_()` | Bangun CSS `:root{--primary:#...}` untuk inject `<?!= getThemeCss() ?>` di `Index.html` atau via `google.script.run`. |

**Cara pakai di app:**
```js
// 01_ConfigAndBridge.gs — inject tema Opsi B
function getThemeCss() { return CoreLib.getThemeCss(PropertiesService.getScriptProperties()); }

// 02_AppLogic.gs — guard manual
CoreLib.assertOwnership(session.user, row.pegawai_id); // throw bila bukan pemilik
CoreLib.validateTransition(row.status, 'diproses', STATUS_MAP, session.user.role === 'admin');
```

Target verifikasi: `testAll()` → **PASS 45 / FAIL 0 / SKIP 1** (tambah 3 test: `testAssertOwnershipV240`, `testValidateTransitionV240`, `testThemeConfigV240`). Versi library next = **16**.

---

## 4. Script Properties

### Di proyek CoreLib (untuk test suite)
| Key | Nilai saat ini | Keterangan |
|---|---|---|
| `SPREADSHEET_ID` | `1SoP4hX9iBkoPdzBl5zhKjV6OA5bb3xiyNdKox_nXcqc` | Spreadsheet test `CORELIB_TEST_DB` |
| `MASTER_SPREADSHEET_ID` | `1HvMXmvdtgAUZ9A0-SQHZp9QjnYv1A7Ku_oJIjbT8gT0` | Master SIMPEG Pemkab |
| `TEST_SPREADSHEET_ID_B` | *(kosong)* | Opsional — hanya untuk `testCacheIsolation`; kalau kosong test itu SKIP (normal) |
| `PLATFORM_API_URL` | *(kosong)* | URL web app SI-PLATFORM untuk test SSO |

### Di proyek aplikasi konsumen
| Key | Keterangan |
|---|---|
| `SPREADSHEET_ID` | Database lokal aplikasi |
| `MASTER_SPREADSHEET_ID` | Master SIMPEG |
| `PLATFORM_API_URL` | Endpoint validasi tiket SSO SI-PLATFORM |
| `APP_CODE` / `APP_TITLE` | Identitas aplikasi (dipakai template `Code.gs`) |
| `ADMIN_EMAILS` / `VERIFIKATOR_EMAILS` | Whitelist role (pisahkan dengan koma). **Tidak ada default** — app wajib mengisinya sendiri |
| `ROOT_FOLDER_ID` / `EVIDENCE_FOLDER_ID` / `BACKUP_FOLDER_ID` | Folder Drive (dibuat/dipakai `executeAppSetup`) |

---

## 5. Cara Menjalankan Test (di editor CoreLib)

| Fungsi | Kegunaan | Hasil yang diharapkan |
|---|---|---|
| **`testAll()`** | Test lengkap resmi (**46 test total**, termasuk akses spreadsheet) | **`PASS: 45 / FAIL: 0 / SKIP: 1`** — SKIP = `testCacheIsolation` (butuh `TEST_SPREADSHEET_ID_B`) |
| `cekUpdateCorelib()` | Diagnostik cepat: fungsi v2.2/v2.3.0/v2.4.0 tersedia? properti benar? | Semua ✅. Baris `❌ CoreLib is not defined` **normal** bila dijalankan di dalam proyek CoreLib sendiri (library tidak me-reference dirinya sendiri) |
| `runCoreTests()` langsung | Tanpa `ctx` → `ctx = {}` | `PASS: 21 / FAIL: 0 / SKIP: 25` — test database otomatis SKIP. Bukan pengganti `testAll()` |

Setiap rilis wajib: `testAll()` → **FAIL: 0** + `[PASS] testRoleGateV222` + `[PASS] testTodayIsoLocalV230` / `[PASS] testDateKey10V230` / `[PASS] testPaginateV230` / `[PASS] testMatchSearchV230` + `[PASS] testAssertOwnershipV240` / `[PASS] testValidateTransitionV240` / `[PASS] testThemeConfigV240`.

### Distribusi 46 test

| Grup | Jumlah | Keterangan |
|---|---|---|
| File 1 (Foundation) | 12 | Database, cache, tanggal, PK, audit |
| File 2 (Gateway) | 11 | SSO, session, role, dispatcher, router |
| v2.1 | 6 | Role levels, tanggal, jabatan, unit bawahan, action not found, session expired |
| v2.2 | 9 | Util publik baru (norm/parse/whitelist/validate/genUnique/requireRole/checkRole/getRoleForEmail/isAllowedConfigKey) |
| v2.2.2 | 1 | Regresi fail-closed `levelOf_` (`testRoleGateV222`) |
| **v2.3.0** | **4** | **`testTodayIsoLocalV230`, `testDateKey10V230`, `testPaginateV230`, `testMatchSearchV230`** |
| **v2.4.0** | **3** | **`testAssertOwnershipV240`, `testValidateTransitionV240`, `testThemeConfigV240`** |
| **Total** | **46** | PASS 45 + SKIP 1 (cacheIsolation) |

---

## 6. Prosedur Rilis (deploy perubahan CoreLib)

1. Ubah file di repo ini (`LIbrary-CoreLib/src/`) — workspace = sumber kebenaran.
2. Paste file yang berubah ke editor GAS CoreLib (whole-file, jangan find-replace manual).
3. Jalankan `testAll()` → pastikan `FAIL: 0`.
4. **Simpan versi library baru** (versi akan bertambah: 13, 14, 15, dst).
5. Naikkan pin `"version"` di `appsscript.json` aplikasi yang *pinned*.
6. Unggah salinan file yang berubah ke GitHub (`backend/*.gs`) agar repo = live.
7. Tag GitHub dengan nomor versi baru (`v2.3.0`).
8. Perbarui dokumen ini (changelog + nomor versi) dan `STATUS_PROYEK.md` workspace.

> ⚠️ **Urutan penting**: paste → test → save versi → bump pin → GitHub.
> Jangan pernah men-tag/mengunggah ke GitHub sebelum kode terverifikasi di GAS.

---

## 7. Kontrak Penting (jangan dilanggar)

- **Fail-closed**: role tidak dikenal / viewer = level 0. Tidak boleh ada fallback `|| 1` di mana pun.
- **Kolom audit** (`created_by`, dst.) di-strip dari payload user — hanya diisi server (`testAuditStrip`).
- **`testMode` sudah DIHAPUS** — exchange tiket palsu selalu ditolak (`testTestModeRemoved`).
- **Sheet referensi master tidak boleh dibuat/ditulis** oleh fungsi baca.
- **Tanggal disimpan ISO-8601**; tampilan `dd/MM/yyyy` urusan frontend.
- **`todayIso()` adalah UTC** — JANGAN dipakai untuk form/validasi/perbandingan tanggal user.
  Gunakan `todayIsoLocal()` atau `dateKey10()` (v2.3.0) yang sadar zona waktu Script.
- **`_cacheBust` dibuang** `dispatchAction` sebelum routing.

---

## 8. Keputusan: Config App di Script Properties (C3, 2026-09-16)

Konfigurasi tingkat aplikasi (SPREADSHEET_ID, MASTER_SPREADSHEET_ID, platform URL, dsb.) disimpan di **Script Properties** (Project Settings → Script properties), **bukan** di sheet `KONFIGURASI`. Alasan: (1) config dibaca sebelum DB terbuka — menyimpannya di sheet menciptakan masalah ayam-telur; (2) Script Properties tidak terbawa ekspor/salinan sheet sehingga tidak bisa diubah tanpa sengaja oleh pengguna non-teknis; (3) satu sumber kebenaran per deployment (dev/prod bisa beda properti tanpa beda kode). Konsekuensi: tidak ada fungsi `saveConfigItem_` untuk menulis config dari UI — perubahan config adalah tindakan deployment yang disengaja. Data yang bersifat *operasional* (daftar nilai, katalog, referensi) tetap di sheet.

---

## 9. Publik API (untuk App Konsumer)

Daftar fungsi yang bisa dipanggil via `CoreLib.xxx` dari aplikasi konsumen.

### Util umum (v2.2)
| Fungsi | Deskripsi |
|---|---|
| `CoreLib.normId(v)` | Normalisasi ID/string: trim + safe null |
| `CoreLib.normStr(v)` | Normalisasi string: trim + lowercase |
| `CoreLib.parseDate(v)` | Parse tanggal multi-format → `Date` atau `null` |
| `CoreLib.whitelist(val, allowed, fieldName)` | Validasi nilai terhadap whitelist (case-insensitive), return nilai kanonik |
| `CoreLib.validateFields(obj, fields)` | Validasi field wajib, throw bila kosong |
| `CoreLib.genUniqueCode(prefix, sheet, field, pad, ssId, headersMap)` | Generate kode unik per sheet |

### Auth & role (v2.2)
| Fungsi | Deskripsi |
|---|---|
| `CoreLib.requireRole(user, minRole, customLevels)` | Throw bila role user < minRole |
| `CoreLib.checkRole(user, action, actionRoleMap)` | `{allowed, minRole, error}` |
| `CoreLib.getRoleForEmail(email, store)` | Tentukan role dari whitelist `ADMIN_EMAILS`/`VERIFIKATOR_EMAILS` |
| `CoreLib.isAllowedConfigKey(key, extraKeys)` | Cek apakah key config boleh diubah dari UI |

### Util tanggal sadar-WIB (v2.3.0 / C3) ⭐
| Fungsi | Deskripsi |
|---|---|
| `CoreLib.todayIsoLocal()` | Tanggal hari ini `yyyy-MM-dd` menurut zona waktu Script |
| `CoreLib.dateKey10(val)` | Kunci tanggal `yyyy-MM-dd` sadar zona waktu Script |

### Util paginasi & pencarian (v2.3.0 / C1, C2)
| Fungsi | Deskripsi |
|---|---|
| `CoreLib.paginate(rows, page, limit)` | Potong array untuk paginasi server-side |
| `CoreLib.matchSearch(row, q, fields)` | Cek substring case-insensitive pada beberapa field |

### Workflow & Ownership (v2.4.0) ⭐ — SUDAH MASUK DRAFT
| Fungsi | Deskripsi |
|---|---|
| `CoreLib.assertOwnership(actor, ownerId, opts)` | Guard kepemilikan baris (throw bila bukan pemilik, admin bypass). |
| `CoreLib.checkOwnership(actor, ownerId, opts)` | Versi non-throw: `{allowed, error}`. |
| `CoreLib.validateTransition(cur, tgt, map, isAdmin)` | Validasi peta status workflow (case-insensitive, isAdmin bypass). |

### Tema Dinamis (v2.4.0 / C8) ⭐ — SUDAH MASUK DRAFT
| Fungsi | Deskripsi |
|---|---|
| `CoreLib.getThemeConfig(store)` | Baca tema dari `THEME_JSON`/`THEME_CODE` → objek tema lengkap. |
| `CoreLib.buildThemeCss(theme)` | Bangun CSS `:root{--primary:...}` dari objek/code. |
| `CoreLib.getThemeCss(store)` | Baca + bangun CSS sekali panggil (untuk `<?!= getThemeCss() ?>`). |

### Kandidat promosi berikutnya (v2.5.0+)
| Kode | Kandidat | Status |
|---|---|---|
| C6 | `periodeBulan` / `dalamPeriode` / `hitungHariKerja` | Antre |
| C7 | `findUnique` / `upsertUnique` by unique-key | Antre |
| C9 | `auditLog` helper terpusat? | Diskusi |
