// ============================================================
// CORE LIBRARY GLOBAL v2.4.0 - 01_CoreFoundation.gs
// Changelog v2.4.0 (2026-09-22):
// - Sinkron rilis v2.4.0 (C4/C5 di 02_CoreGateway, C8 di 03_CoreServices).
//   Tanpa perubahan fungsional di berkas ini selain bump header.
// Changelog v2.3.0 (2026-09-19):
// - ADD (C3) — FIX UTC vs WIB: todayIsoLocal_() & dateKey10_() publik.
//   todayIso() LAMA memakai UTC — mundur 1 hari untuk user WIB sebelum
//   07:00 (Asia/Jakarta = UTC+7). Fungsi baru ini sadar zona waktu Script
//   via Utilities.formatDate(val, Session.getScriptTimeZone(), ...).
//   todayIso() LAMA TIDAK DIUBAH (backward-compat app lama).
// - ADD (C1): paginate_(rows, page, limit) — potong array untuk paginasi
//   server-side, kembalikan { success, data, meta }.
// - ADD (C2): matchSearch_(row, q, fields) — cek substring case-insensitive
//   pada beberapa field, q kosong → selalu true.
// - Wrapper publik tanpa underscore: todayIsoLocal, dateKey10, paginate,
//   matchSearch (pintu API untuk app konsumer via CoreLib.xxx).
// - Aditif murni: seluruh util lama TIDAK diubah signature-nya.
// Changelog v2.2.4 (2026-09-16):
// - ADD (C1): ensureSheet menerima options.decorate {bg, font, bold, frozen} —
//   kosmetik header aditif; perilaku default TIDAK berubah (si-pelaporan pin v13 aman).
// Changelog v2.2.3 (2026-09-16):
// - Sinkron rilis v2.2.3 (fix levelOf_ ada di 02_CoreGateway). Tanpa
//   perubahan fungsional di berkas ini.
// Changelog v2.2.2 (2026-09-15):
// - Sinkron rilis v2.2.2 (perbaikan gating role ada di 02_CoreGateway).
//   Tanpa perubahan fungsional di berkas ini.
// Changelog v2.2.1 (2026-09-13):
// - BUGFIX genUniqueCode_: hapus fallback regex /(\d+)/ yang
//   menangkap angka dari ID tak berhubungan (mis. timestamp di
//   'DUP-1789236036660') → hasil lompat/duplikat.
//   Sekarang HANYA match ID yang benar-benar diawali prefix.
// Changelog v2.2.0 (2026-09-12):
// - UTIL PUBLIK BARU (untuk konsumsi app via CoreLib.xxx):
//     normId_, normStr_             — normalisasi string/ID
//     parseDate_                    — alias parseTanggalBackend (canonical)
//     whitelist_                    — validasi nilai, case-insensitive, return kanonik
//     validateFields_               — validasi field wajib, throw bila kosong
//     genUniqueCode_                — generate kode unik per sheet (pakai ssId eksplisit)
// - PUBLIC API WRAPPER (tanpa underscore — bisa dipanggil CoreLib.normId, dst):
//     normId, normStr, parseDate, whitelist, validateFields, genUniqueCode
// - P1-B4 FIX: resolveCanonical_ — cari case-insensitive di headersMap
//              sebelum fallback uppercase (cegah sheet camelCase jadi MAINDATA).
// - FIX: whitelist_ case-insensitive, return nilai kanonik dari `allowed`.
// Changelog v2.1 (2026-09-12):
// - P1-A1 FIX: MASTER_ROLE_LEVELS diperluas (tambah 'user' & 'verifikator').
// - P1-A2 FIX: acquireLock timeout diturunkan (5s+5s).
// - P1-A3 FIX: toAlignedRow_ handle Date object -> ISO.
// - P1-A4 FIX: getSheetDataCached log WARN bila data > 100 KB.
// Changelog v2:
// - C1 FIX: update/soft/hard-delete pakai nomor baris FISIK.
// - C2 FIX: tulis selaras urutan kolom SHEET by-name + overlay full-width.
// - C3 FIX: cache dinamespace per database; TTL di-cap 21600.
// - H1 FIX: getRecordPrimaryId_ dukung pkField + auto-deteksi kolom *_id.
// - H3 FIX: baca TIDAK BOLEH membuat sheet referensi.
// - H5 FIX: merge update: undefined=pertahankan, null/''=kosongkan.
// - H4 FIX: formatDateForSheet kanonik ISO.
// - M2 FIX: kolom audit standar dipastikan ada di sheet non-referensi.
// - BARU: DEFAULT_SYSTEM_HEADERS di-merge otomatis.
// ============================================================

// ============================================================
// §1 KONSTANTA GLOBAL
// ============================================================

// 5 level standar. App bisa override via config.roleLevels.
// - viewer      : hanya baca
// - user        : boleh input data sendiri
// - verifikator : boleh verifikasi/approve data
// - admin       : boleh kelola master & konfigurasi
// - super       : boleh setup sistem & cleanup
var MASTER_ROLE_LEVELS = { viewer: 0, user: 1, verifikator: 2, admin: 3, super: 4 };

var MASTER_REFERENCE_SHEETS = ['PEGAWAI', 'JABATAN', 'UNIT_KERJA'];

var MASTER_SHEET_HEADERS = {
  PEGAWAI: ['pegawai_id','nip','nama','gelar_depan','gelar_belakang','jenis_kelamin','tanggal_lahir','pangkat_golongan','status_kepegawaian','pendidikan_terakhir','email','no_hp','alamat','foto_url','unit_id','jabatan_id','atasan_id','role','status','created_at','updated_at'],
  JABATAN: ['jabatan_id','kode_jabatan','nama_jabatan','unit_id','plt_pegawai_id','jenis_jabatan','kelas_jabatan','status','status_jabatan','tanggal_mulai_jabatan','tanggal_selesai_jabatan','keterangan','created_at','updated_at'],
  UNIT_KERJA: ['unit_id','kode_unit','nama_unit','parent_unit_id','kepala_unit_id','jenis_unit','status','keterangan','created_at','updated_at']
};

// Tabel sistem: otomatis tersedia walau app lupa mendefinisikan.
var DEFAULT_SYSTEM_HEADERS = {
  AUDIT_LOGS: ['id','user_id','action','timestamp','details'],
  KONFIGURASI: ['id','key','value','keterangan','created_at','created_by','updated_at','updated_by','deleted_at'],
  MAIN_DATA: ['id','nama','nip','email','unit_nama','jabatan_nama','alamat','no_hp','created_at','created_by','updated_at','updated_by','deleted_at']
};

var AUDIT_COLUMNS = ['created_at','created_by','updated_at','updated_by','deleted_at'];
var CACHE_MAX_TTL = 21600; // batas ScriptCache (6 jam)

function capTtl_(s) {
  s = Number(s) || 180;
  if (s < 60) s = 60;
  if (s > CACHE_MAX_TTL) s = CACHE_MAX_TTL;
  return s;
}

// PERHATIAN skop library: tanpa argumen store, ini membaca Properties MILIK LIBRARY
// (dipakai bersama 30 app). Untuk config per-app, oper store dari KODE APLIKASI:
//   getEnvProperty('SPREADSHEET_ID', PropertiesService.getScriptProperties())
function getEnvProperty(key, store) {
  try {
    var st = store || PropertiesService.getScriptProperties();
    return st.getProperty(key) || '';
  } catch (e) { return ''; }
}

function isReferenceSheet(sheetName) {
  if (!sheetName) return false;
  return MASTER_REFERENCE_SHEETS.indexOf(String(sheetName).trim().toUpperCase()) !== -1;
}

function getCanonicalSheetName(sheetName, localMap) {
  if (!sheetName) return null;
  var search = String(sheetName).toUpperCase().trim();
  if (MASTER_REFERENCE_SHEETS.indexOf(search) !== -1) return search;
  if (localMap && localMap[search]) return (typeof localMap[search] === 'string') ? localMap[search] : search;
  if (search === 'LOG' || search === 'AUDIT') return 'AUDIT_LOGS';
  if (search === 'CONFIG' || search === 'SETTING') return 'KONFIGURASI';
  return null;
}

// v2.2 (P1-B4): case-insensitive lookup di headersMap sebelum fallback uppercase.
function resolveCanonical_(sheetName, headersMap) {
  if (!sheetName) return '';
  var raw = String(sheetName).trim();
  var upper = raw.toUpperCase();

  // 1. Cek system & reference (case-insensitive)
  if (MASTER_REFERENCE_SHEETS.indexOf(upper) !== -1) return upper;
  if (DEFAULT_SYSTEM_HEADERS[upper]) return upper;
  if (MASTER_SHEET_HEADERS[upper]) return upper;

  // 2. Cek headersMap: exact → uppercase → case-insensitive scan
  if (headersMap) {
    if (headersMap[raw] !== undefined) return raw;
    if (headersMap[upper] !== undefined) return upper;
    var keys = Object.keys(headersMap);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toUpperCase() === upper) return keys[i];
    }
  }

  // 3. Alias sistem
  if (upper === 'LOG' || upper === 'AUDIT') return 'AUDIT_LOGS';
  if (upper === 'CONFIG' || upper === 'SETTING') return 'KONFIGURASI';

  // 4. Fallback uppercase (konvensi lama)
  return upper;
}

// Resolve header: map app -> default sistem -> master SIMPEG -> kunci record.
function resolveHeaders_(canonical, headersMap, record) {
  if (headersMap && headersMap[canonical]) return { headers: headersMap[canonical].slice(), known: true };
  if (DEFAULT_SYSTEM_HEADERS[canonical]) return { headers: DEFAULT_SYSTEM_HEADERS[canonical].slice(), known: true };
  if (MASTER_SHEET_HEADERS[canonical]) return { headers: MASTER_SHEET_HEADERS[canonical].slice(), known: true };
  return { headers: record ? Object.keys(record) : [], known: false };
}

// ============================================================
// §2 LOGGING
// ============================================================
function logInfo(context, message) { Logger.log('[INFO][' + context + '] ' + message); }
function logWarn(context, message) { Logger.log('[WARN][' + context + '] ' + message); }
function logError(context, error) { Logger.log('[ERROR][' + context + '] ' + (error && error.message ? error.message : error)); }

// ============================================================
// §3 UTIL DASAR
// ============================================================
function makeId(prefix) { return (prefix || 'id') + '_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 8); }
function nowIso() { return new Date().toISOString(); }
function todayIso() { return new Date().toISOString().slice(0, 10); }

function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id || user.user_id || user.pegawai_id || '',
    username: user.username || user.email || '',
    role: user.role || 'viewer',
    pegawai_id: user.pegawai_id || ''
  };
}

// ============================================================
// §4 UTIL PUBLIK BARU (v2.2)
// ============================================================

/**
 * Normalisasi ID/string: trim + safe null.
 * Return selalu string ('' kalau null/undefined).
 */
function normId_(v) {
  return String(v == null ? '' : v).trim();
}

/**
 * Normalisasi string untuk perbandingan: trim + lowercase.
 */
function normStr_(v) {
  return normId_(v).toLowerCase();
}

/**
 * Alias canonical dari parseTanggalBackend.
 * Mendukung: ISO datetime, yyyy-MM-dd, dd/MM/yyyy, Date object.
 * Return Date atau null.
 */
function parseDate_(v) {
  return parseTanggalBackend(v);
}

/**
 * Validasi nilai terhadap daftar yang diizinkan (case-insensitive).
 * Return nilai KANONIK dari `allowed` (bukan input user).
 * Throw error kalau tidak match.
 *
 * @param {*} val - nilai dari user
 * @param {Array} allowed - daftar nilai valid (case-insensitive)
 * @param {string} fieldName - nama field (untuk pesan error)
 * @returns {*} nilai kanonik dari `allowed`
 */
function whitelist_(val, allowed, fieldName) {
  if (!Array.isArray(allowed)) {
    throw new Error('Daftar whitelist untuk ' + (fieldName || 'field') + ' tidak valid.');
  }
  var v = normId_(val);
  var vLower = v.toLowerCase();
  for (var i = 0; i < allowed.length; i++) {
    if (String(allowed[i]).trim().toLowerCase() === vLower) {
      return allowed[i];
    }
  }
  throw new Error('Nilai "' + val + '" tidak valid untuk ' + (fieldName || 'field') + '.');
}

/**
 * Validasi field wajib isi. Throw error kalau ada yang kosong.
 * Kosong = undefined, null, atau string kosong/whitespace.
 *
 * @param {Object} obj
 * @param {string[]} fields
 * @throws {Error}
 */
function validateFields_(obj, fields) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Objek tidak valid untuk validasi.');
  }
  if (!Array.isArray(fields) || fields.length === 0) return;
  var missing = [];
  for (var i = 0; i < fields.length; i++) {
    var v = obj[fields[i]];
    if (v === undefined || v === null || String(v).trim() === '') {
      missing.push(fields[i]);
    }
  }
  if (missing.length > 0) {
    throw new Error('Field wajib diisi: ' + missing.join(', ') + '.');
  }
}

/**
 * Generate kode unik dengan format {prefix}{number} dengan pad width.
 *
 * v2.2.1 (fix): HANYA match ID yang benar-benar diawali prefix.
 * Sebelumnya ada fallback regex /(\d+)/ yang menangkap angka dari ID
 * tak berhubungan (mis. timestamp di 'DUP-1789236036660') → hasil ngawur.
 *
 * Contoh:
 *   prefix='DKL-', existing=['DKL-001','DKL-002'] → 'DKL-003'
 *   prefix='DKL-', existing=['DKL-001-A','DKL-002-B'] → 'DKL-003'
 *   prefix='UNIQ-<ts>-', existing=[] → 'UNIQ-<ts>-001'
 *
 * @param {string} prefix
 * @param {string} sheetName
 * @param {string} field - kolom tempat kode disimpan
 * @param {number} padWidth - default 3
 * @param {string} ssId - spreadsheet ID (WAJIB)
 * @param {Object} headersMap - optional
 * @returns {string}
 */
function genUniqueCode_(prefix, sheetName, field, padWidth, ssId, headersMap) {
  padWidth = padWidth || 3;
  if (!ssId) {
    throw new Error('genUniqueCode_ butuh ssId (spreadsheetId) eksplisit.');
  }
  if (!sheetName || !field) {
    throw new Error('genUniqueCode_ butuh sheetName dan field.');
  }

  var rows = getSheetDataCached(ssId, sheetName, headersMap || {}, 60);
  var maxNum = 0;

  var prefixStr = String(prefix);
  // Escape karakter regex di prefix
  var escaped = prefixStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // HANYA match ID yang diawali prefix (case-insensitive), tangkap angka setelahnya
  var reAfterPrefix = new RegExp('^' + escaped + '(\\d+)', 'i');

  for (var i = 0; i < rows.length; i++) {
    var c = String(rows[i][field] || '');
    if (!c) continue;
    var m = c.match(reAfterPrefix);
    if (m) {
      var num = Number(m[1]);
      if (num > maxNum) maxNum = num;
    }
  }

  var next = maxNum + 1;
  var numStr = ('000000' + next).slice(-padWidth);
  return prefixStr + numStr;
}

// ============================================================
// §5 LOCKING
// ============================================================

// v2.1: total wait max ~10.5s (sebelumnya 26s). Aman di web app GAS (30s limit).
function acquireLock() {
  var lock = LockService.getScriptLock();
  if (lock.tryLock(5000)) return lock;
  Utilities.sleep(500);
  if (lock.tryLock(5000)) return lock;
  return null;
}

// ============================================================
// §6 PRIMARY KEY
// ============================================================

// H1: pkField eksplisit -> daftar dikenal -> auto-deteksi kolom *_id pertama.
function getRecordPrimaryId_(record, pkField) {
  if (!record) return '';
  if (pkField && record[pkField] !== undefined && record[pkField] !== null && String(record[pkField]).trim() !== '') return String(record[pkField]).trim();
  var known = ['id', 'pegawai_id', 'unit_id', 'jabatan_id', 'riwayat_id'];
  for (var i = 0; i < known.length; i++) {
    var v = record[known[i]];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  var keys = Object.keys(record);
  for (var j = 0; j < keys.length; j++) {
    if (/_id$/i.test(keys[j])) {
      var w = record[keys[j]];
      if (w !== undefined && w !== null && String(w).trim() !== '') return String(w).trim();
    }
  }
  return '';
}

// ============================================================
// §7 TANGGAL
// ============================================================
function parseTanggalBackend(val) {
  try {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    var str = String(val).trim();
    if (str.indexOf('T') !== -1) { var d = new Date(str); if (!isNaN(d.getTime())) return d; }
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      var p = str.split('T')[0].split('-');
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    var ps = str.split(' ')[0].split('/');
    if (ps.length === 3) return new Date(Number(ps[2]), Number(ps[1]) - 1, Number(ps[0]));
    return null;
  } catch (e) { logError('parseTanggalBackend', e.message); return null; }
}

function safeFormatDateForFrontend(val) {
  if (!val) return '';
  var d = parseTanggalBackend(val);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(val);
}

function safeFormatDateTimeForFrontend(val) {
  if (!val) return '';
  var d = parseTanggalBackend(val);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(val);
}

function formatTanggalIndonesia(date) {
  try {
    if (!date) return '-';
    if (!(date instanceof Date)) date = parseTanggalBackend(date);
    if (!date || isNaN(date.getTime())) return '-';
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  } catch (e) { logError('formatTanggalIndonesia', e.message); return '-'; }
}

function isValidDate(val) {
  var d = parseTanggalBackend(val);
  return d !== null && !isNaN(d.getTime());
}

function hitungUmur(birthDate, todayDate) {
  if (!birthDate) return 0;
  if (!(birthDate instanceof Date)) birthDate = parseTanggalBackend(birthDate);
  if (!birthDate) return 0;
  var today = todayDate || new Date();
  var umur = today.getFullYear() - birthDate.getFullYear();
  var m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) umur--;
  return Math.max(0, umur);
}

function hitungDurasiHari(a, b) {
  var m = parseTanggalBackend(a), s = parseTanggalBackend(b);
  if (!m || !s) return 0;
  return Math.max(0, Math.ceil((s.getTime() - m.getTime()) / 86400000));
}

function hitungDurasiBulan(tanggalMulai) {
  if (!tanggalMulai) return 0;
  var m = parseTanggalBackend(tanggalMulai);
  if (!m) return 0;
  var n = new Date();
  return Math.max(0, (n.getFullYear() - m.getFullYear()) * 12 + (n.getMonth() - m.getMonth()));
}

function hitungDurasiMenit(a, b) {
  try {
    if (!a || !b) return 0;
    var mp = String(a).split(':').map(Number), sp = String(b).split(':').map(Number);
    if (isNaN(mp[0]) || isNaN(sp[0])) return 0;
    return Math.max(0, (sp[0] * 60 + (sp[1] || 0)) - (mp[0] * 60 + (mp[1] || 0)));
  } catch (e) { return 0; }
}

// H4: kanonik ISO untuk PENYIMPANAN. dd/MM hanya untuk TAMPILAN.
function formatDateForSheet(val) {
  try {
    if (!val) return '';
    if (val instanceof Date) return isNaN(val.getTime()) ? '' : val.toISOString();
    var d = parseTanggalBackend(val);
    return d ? d.toISOString() : String(val);
  } catch (e) { logError('formatDateForSheet', e.message); return String(val); }
}

// ============================================================
// §7b TANGGAL SADAR ZONA WAKTU (v2.3.0 / C3)
// ------------------------------------------------------------
// todayIso() di atas memakai UTC — mundur 1 hari untuk user WIB
// sebelum 07:00 (Asia/Jakarta = UTC+7). Fungsi di bawah ini SADAR
// zona waktu Script sehingga aman untuk form/validasi/perbandingan.
// ============================================================

/**
 * todayIsoLocal_() — tanggal hari ini 'yyyy-MM-dd' menurut zona waktu
 * Script (Asia/Jakarta). BEDA dengan todayIso() yang memakai UTC.
 *
 * Gunakan untuk: form default tanggal, kunci tanggal, perbandingan
 * tanggal, filter "hari ini", dsb.
 *
 * @returns {string} 'yyyy-MM-dd'
 */
function todayIsoLocal_() {
  try {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (e) {
    // Fallback darurat: potong dari ISO UTC (jarang terjadi di runtime GAS).
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * dateKey10_(val) — konversi nilai tanggal apa pun menjadi kunci
 * 'yyyy-MM-dd' yang SADAR ZONA WAKTU Script.
 *
 * Menangani:
 *   - Date object → format lokal
 *   - String ISO penuh ('2026-09-19T...') → parse lalu format lokal
 *   - String legacy 'dd/MM/yyyy' atau 'yyyy-MM-dd HH:mm' → parse lalu
 *     format lokal
 *   - String 'yyyy-MM-dd' murni → potong 10 karakter
 *
 * Bug yang dicegah: parseTanggalBackend('yyyy-MM-dd') menghasilkan
 * tengah malam LOKAL, lalu toISOString() (UTC) menggeser mundur 1 hari
 * di WIB (+7).
 *
 * @param {*} val
 * @returns {string} 'yyyy-MM-dd' atau '' bila tidak valid
 */
function dateKey10_(val) {
  if (!val) return '';
  var tz = Session.getScriptTimeZone();
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : Utilities.formatDate(val, tz, 'yyyy-MM-dd');
  }
  var str = String(val).trim();
  if (!str) return '';
  // ISO penuh / legacy dd/MM / 'yyyy-MM-dd HH:mm' → parse lalu format LOKAL.
  if (str.indexOf('T') !== -1 || str.indexOf('/') !== -1 || str.indexOf(' ') !== -1) {
    var d = parseTanggalBackend(str);
    if (d && !isNaN(d.getTime())) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  }
  // 'yyyy-MM-dd...' murni / sisa kasus → potong 10 char
  return str.slice(0, 10);
}

// ============================================================
// §8 SIMPEG HELPERS
// ============================================================
function getUnitNama(units, unitId) {
  if (!Array.isArray(units)) return unitId || '-';
  var u = null;
  for (var i = 0; i < units.length; i++) { if (String(units[i].unit_id) === String(unitId)) { u = units[i]; break; } }
  return u ? u.nama_unit : (unitId || '-');
}

function getPegawaiById(pegawai, id) {
  if (!Array.isArray(pegawai)) return null;
  for (var i = 0; i < pegawai.length; i++) { if (String(pegawai[i].pegawai_id) === String(id)) return pegawai[i]; }
  return null;
}

function getJabatanById(jabatan, id) {
  if (!Array.isArray(jabatan)) return null;
  for (var i = 0; i < jabatan.length; i++) { if (String(jabatan[i].jabatan_id) === String(id)) return jabatan[i]; }
  return null;
}

// includeSelf default TRUE. Hasil termasuk unit itu sendiri + semua turunan.
function getUnitBawahanSimple(unitKerja, unitId, includeSelf) {
  if (!unitId || !Array.isArray(unitKerja)) return [];
  var self = (includeSelf === undefined) ? true : !!includeSelf;
  var hasil = {}, queue = [String(unitId)], out = [];
  var first = true;
  while (queue.length) {
    var cur = queue.shift();
    if (hasil[cur]) continue;
    hasil[cur] = true;
    if (self || !first) out.push(cur);
    first = false;
    unitKerja.forEach(function(u) { if (String(u.parent_unit_id) === cur) queue.push(String(u.unit_id)); });
  }
  return out;
}

function getLevelJabatan(j) {
  if (!j) return 'tidak_diketahui';
  var nama = String(j.nama_jabatan || '').toUpperCase();
  if (nama.indexOf('KEPALA SATUAN') !== -1) return 'eselon_II';
  if (nama.indexOf('SEKRETARIS') !== -1) return 'sekretaris';
  if (nama.indexOf('KEPALA BIDANG') === 0 || nama.indexOf('KABID') !== -1) return 'kabid';
  if (nama.indexOf('KASUBBAG') !== -1) return 'kasubbag';
  if (nama.indexOf('KEPALA SEKSI') !== -1 || nama.indexOf('KASI ') !== -1) return 'kasi';
  if (nama.indexOf('AHLI MADYA') !== -1) return 'jft_madya';
  if (nama.indexOf('AHLI MUDA') !== -1 || nama.indexOf('MAHIR') !== -1) return 'jft_muda';
  if (nama.indexOf('PEMULA') !== -1 || nama.indexOf('TERAMPIL') !== -1) return 'jft_terampil';
  if (String(j.jenis_jabatan).toUpperCase() === 'UMUM') return 'staf_umum';
  if (String(j.jenis_jabatan).toUpperCase() === 'FUNGSIONAL') return 'staf_fungsional';
  return 'staf_lainnya';
}

function getDistribusiPegawaiPerUnit(pegawai, unitKerja) {
  var counts = {};
  if (Array.isArray(unitKerja)) unitKerja.forEach(function(u) { counts[String(u.unit_id)] = 0; });
  if (Array.isArray(pegawai)) pegawai.forEach(function(p) { if (p.unit_id && counts.hasOwnProperty(String(p.unit_id))) counts[String(p.unit_id)]++; });
  return counts;
}

// CATAT: bucket pensiun1/3/5 KUMULATIF tumpang-tindih. BUP flat.
function kalkulasiStatistikDasar(pegawai, jabatan, today, bup, batasMendekati) {
  var tglToday = today || new Date(), batasBup = bup || 58, batasUmur = batasMendekati || 55, tahunIni = tglToday.getFullYear();
  var mendekatiBUP = 0, pensiun1 = 0, pensiun3 = 0, pensiun5 = 0;
  if (Array.isArray(pegawai)) pegawai.forEach(function(p) {
    if (String(p.status || '').toUpperCase() !== 'AKTIF') return;
    var tgl = parseTanggalBackend(p.tanggal_lahir);
    if (!tgl) return;
    if (hitungUmur(tgl, tglToday) >= batasUmur) mendekatiBUP++;
    var sisa = (tgl.getFullYear() + batasBup) - tahunIni;
    if (sisa <= 1) pensiun1++;
    if (sisa <= 3) pensiun3++;
    if (sisa <= 5) pensiun5++;
  });
  return { mendekatiBUP: mendekatiBUP, pensiun1: pensiun1, pensiun3: pensiun3, pensiun5: pensiun5 };
}

// ============================================================
// §9 VALIDATOR
// ============================================================
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()); }
function isValidNIP(nip) { return /^[0-9]{18}$/.test(String(nip || '').trim()); }
function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }

function normalizeNoHp(value) {
  var raw = String(value || '').replace(/\D/g, '');
  if (!raw) return '';
  if (raw.indexOf('0') !== 0 && raw.indexOf('62') !== 0) raw = '0' + raw;
  if (raw.indexOf('62') === 0) raw = '0' + raw.substring(2);
  return raw;
}

function systemActor() {
  return { id: 'system', username: 'system', role: 'super', pegawai_id: '' };
}

// ============================================================
// §10 ENGINE DB
// ============================================================
function getDb(spreadsheetId) {
  if (!spreadsheetId) {
    var active = null;
    try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { active = null; }
    if (!active) throw new Error('SPREADSHEET_ID tidak dikonfigurasi dan tidak ada spreadsheet aktif.');
    return active;
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

// H3: MENOLAK membuat sheet referensi yang hilang.
function ensureSheet(spreadsheetId, sheetName, sheetHeadersMap, options) {
  options = options || {};
  var canonical = resolveCanonical_(sheetName, sheetHeadersMap);
  var isRef = options.isRefFunc ? options.isRefFunc(canonical) : isReferenceSheet(canonical);
  var ss = getDb(spreadsheetId);
  var sh = ss.getSheetByName(canonical);
  if (!sh) {
    if (isRef) throw new Error('Sheet referensi "' + canonical + '" tidak ada di DB ini. Baca dari database master (masterSsId). Pembuatan salinan lokal dilarang (v2).');
    sh = ss.insertSheet(canonical);
    logInfo('CoreFoundation', 'Sheet baru dibuat: ' + canonical);
  }
  var r = resolveHeaders_(canonical, sheetHeadersMap, null);
  if (r.headers.length === 0) return sh;
  var lastCol = sh.getLastColumn();
  var addedStart = 0, addedCount = 0;
  if (lastCol === 0) {
    sh.getRange(1, 1, 1, r.headers.length).setValues([r.headers]);
    sh.setFrozenRows(1);
    addedStart = 1; addedCount = r.headers.length;
  } else {
    var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    var missing = r.headers.filter(function(h) { return existing.indexOf(h) === -1; });
    if (!isRef) AUDIT_COLUMNS.forEach(function(a) { if (r.headers.indexOf(a) === -1 && existing.indexOf(a) === -1) missing.push(a); });
    if (missing.length > 0) {
      sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
      logInfo('CoreFoundation', 'Kolom ditambahkan ke ' + canonical + ': ' + missing.join(', '));
      addedStart = lastCol + 1; addedCount = missing.length;
    }
  }
  // v2.2.4 (C1): opsi kosmetik header {bg, font, bold, frozen} — hanya diterapkan
  // pada kolom yang BARU ditulis; kegagalan tidak fatal. App tak perlu lagi
  // menulis mekanisme format header sendiri.
  if (options.decorate && addedCount > 0) {
    try {
      var d = options.decorate;
      var rng = sh.getRange(1, addedStart, 1, addedCount);
      if (d.bg) rng.setBackground(d.bg);
      if (d.font) rng.setFontColor(d.font);
      if (d.bold) rng.setFontWeight('bold');
      if (d.frozen) sh.setFrozenRows(d.frozen);
    } catch (eDec) {
      logInfo('CoreFoundation', 'Hias header ' + canonical + ' gagal: ' + eDec.message);
    }
  }
  return sh;
}

function initDatabase(spreadsheetId, sheetHeadersMap, isRefSheetFunc) {
  if (sheetHeadersMap) {
    ['AUDIT_LOGS', 'KONFIGURASI', 'MAIN_DATA'].forEach(function(s) { ensureSheet(spreadsheetId, s, sheetHeadersMap, { isRefFunc: isRefSheetFunc }); });
    Object.keys(sheetHeadersMap).forEach(function(sheetName) {
      var isRef = isRefSheetFunc ? isRefSheetFunc(sheetName) : isReferenceSheet(sheetName);
      if (!isRef) ensureSheet(spreadsheetId, sheetName, sheetHeadersMap, { isRefFunc: isRefSheetFunc });
    });
  }
  return { success: true, message: 'Inisialisasi database berhasil.' };
}

function recordFromRow_(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) {
    var cell = row[i];
    if (cell instanceof Date) obj[h] = isNaN(cell.getTime()) ? '' : cell.toISOString();
    else obj[h] = (cell === null || cell === undefined) ? '' : cell;
  });
  return obj;
}

function rowsToRecords_(sh) {
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var empty = true;
    for (var j = 0; j < values[i].length; j++) {
      if (values[i][j] !== '' && values[i][j] !== null && values[i][j] !== undefined) { empty = false; break; }
    }
    if (!empty) out.push(recordFromRow_(headers, values[i]));
  }
  return out;
}

// options: { masterSsId, isRefFunc }
function readRecordsNoLock(spreadsheetId, sheetName, sheetHeadersMap, options) {
  options = options || {};
  var canonical = resolveCanonical_(sheetName, sheetHeadersMap);
  var isRef = options.isRefFunc ? options.isRefFunc(canonical) : isReferenceSheet(canonical);
  if (isRef && options.masterSsId && options.masterSsId !== spreadsheetId) {
    var msh = getDb(options.masterSsId).getSheetByName(canonical);
    if (!msh) throw new Error('Sheet referensi "' + canonical + '" tidak ada di database master. Cek MASTER_SPREADSHEET_ID.');
    return rowsToRecords_(msh);
  }
  return rowsToRecords_(ensureSheet(spreadsheetId, canonical, sheetHeadersMap, options));
}

// Pemindaian FISIK tanpa filter (untuk update/delete aman) — FIX C1.
function findRowNumberByPk_(sh, pkValue, pkField) {
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1 || pkValue === undefined || pkValue === null || String(pkValue).trim() === '') return -1;
  var target = String(pkValue).trim();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var i = 0; i < values.length; i++) {
    if (getRecordPrimaryId_(recordFromRow_(headers, values[i]), pkField) === target) return i + 2;
  }
  return -1;
}

function readRowByNumber_(sh, rowNumber) {
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  return recordFromRow_(headers, sh.getRange(rowNumber, 1, 1, lastCol).getValues()[0]);
}

function sheetHeaders_(sh) {
  var lastCol = sh.getLastColumn();
  return lastCol < 1 ? [] : sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
}

// C3: key dinamespace per database EFEKTIF (master vs lokal terpisah).
function getSheetDataCached(spreadsheetId, sheetName, sheetHeadersMap, ttlSeconds, options) {
  options = options || {};
  var canonical = resolveCanonical_(sheetName, sheetHeadersMap);
  var isRef = options.isRefFunc ? options.isRefFunc(canonical) : isReferenceSheet(canonical);
  var effId = (isRef && options.masterSsId && options.masterSsId !== spreadsheetId) ? options.masterSsId : spreadsheetId;
  var cacheKey = 'sheetData_' + effId + '_' + canonical;
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) { try { return JSON.parse(cached); } catch (e) { logError('CoreFoundation', 'Cache korup ' + canonical + ', reload.'); } }
  var data = readRecordsNoLock(spreadsheetId, sheetName, sheetHeadersMap, options);
  try {
    var s = JSON.stringify(data);
    if (s.length < 100000) {
      cache.put(cacheKey, s, capTtl_(ttlSeconds || 180));
    } else {
      logWarn('CoreFoundation', 'Data "' + canonical + '" terlalu besar untuk cache (' +
        Math.round(s.length / 1024) + ' KB > 100 KB). Setiap baca akan hit Spreadsheet langsung.');
    }
  } catch (e) {
    logError('CoreFoundation', 'Cache put gagal ' + canonical + ': ' + e.message);
  }
  return data;
}

// dbId WAJIB untuk key baru; tanpa dbId hanya membersihkan key legacy.
function invalidateSheetCache(sheetName, dbId) {
  try {
    var cache = CacheService.getScriptCache();
    if (dbId) cache.remove('sheetData_' + dbId + '_' + String(sheetName || '').toUpperCase().trim());
    else cache.remove('sheetData_' + String(sheetName || '').toUpperCase().trim());
  } catch (e) {}
}

function toSheetRow(sheetName, record, sheetHeadersMap) {
  var r = resolveHeaders_(String(sheetName || '').toUpperCase().trim(), sheetHeadersMap, record);
  if (r.headers.length === 0) return [];
  return r.headers.map(function(h) { var v = record[h]; return (v === undefined || v === null) ? '' : v; });
}

function toAlignedRow_(sheetHeaders, record) {
  return sheetHeaders.map(function(h) {
    var v = record[h];
    if (v === undefined || v === null) return '';
    if (v instanceof Date) return formatDateForSheet(v);
    return v;
  });
}

// Inti upsert 1x-scan. mustExist: null=otomatis, true=update-ketat, false=insert-ketat.
function upsertRow_(sh, record, actor, pkField, mustExist, headersKnown) {
  var now = nowIso();
  var userId = (actor && (actor.id || actor.user_id)) ? (actor.id || actor.user_id) : 'system';
  var headers = sheetHeaders_(sh);
  var pk = getRecordPrimaryId_(record, pkField);
  var rowNumber = pk ? findRowNumberByPk_(sh, pk, pkField) : -1;
  var rec, isUpdate = false;

  if (rowNumber === -1) {
    if (mustExist === true) throw new Error('Record tidak ditemukan (PK: ' + pk + ').');
    rec = Object.assign({}, record);
    if (!pk) rec.id = makeId('rec');
    rec.created_at = rec.created_at || now;
    rec.created_by = userId;
    rec.updated_at = now;
    rec.updated_by = userId;
    if (rec.deleted_at === undefined) rec.deleted_at = '';
    if (headers.length === 0) {
      headers = Object.keys(rec);
      if (headers.length === 0) throw new Error('Record kosong, tidak ada kolom.');
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      headersKnown = false;
    }
    if (!headersKnown) {
      var added = Object.keys(rec).filter(function(k) { return headers.indexOf(k) === -1; });
      if (added.length > 0) { sh.getRange(1, headers.length + 1, 1, added.length).setValues([added]); headers = headers.concat(added); }
    }
    sh.appendRow(toAlignedRow_(headers, rec));
  } else {
    if (mustExist === false) throw new Error('Record dengan PK "' + pk + '" sudah ada (duplikat).');
    isUpdate = true;
    var old = readRowByNumber_(sh, rowNumber);
    rec = {};
    headers.forEach(function(h) {
      if (record[h] !== undefined) rec[h] = (record[h] === null ? '' : record[h]);
      else rec[h] = (old[h] !== undefined ? old[h] : '');
    });
    rec.created_at = old.created_at || now;
    rec.created_by = old.created_by || userId;
    rec.updated_at = now;
    rec.updated_by = userId;
    if (rec.deleted_at === undefined) rec.deleted_at = old.deleted_at || '';
    sh.getRange(rowNumber, 1, 1, headers.length).setValues([toAlignedRow_(headers, rec)]);
  }
  SpreadsheetApp.flush();
  return { record: rec, isUpdate: isUpdate };
}

function writeRecordNoLock(spreadsheetId, sheetName, record, isUpdate, actor, sheetHeadersMap, isRefSheetFunc, pkField) {
  var canonical = resolveCanonical_(sheetName, sheetHeadersMap);
  var isRef = isRefSheetFunc ? isRefSheetFunc(canonical) : isReferenceSheet(canonical);
  if (isRef) throw new Error('Sheet "' + canonical + '" bersifat read-only (SIMPEG), penulisan tidak diizinkan.');
  var r = resolveHeaders_(canonical, sheetHeadersMap, record);
  var sh = ensureSheet(spreadsheetId, canonical, sheetHeadersMap, { isRefFunc: isRefSheetFunc });
  var out = upsertRow_(sh, record || {}, actor, pkField, isUpdate ? true : false);
  invalidateSheetCache(canonical, spreadsheetId);
  return out.record;
}

function softDeleteRecordNoLock(spreadsheetId, sheetName, id, actor, sheetHeadersMap, isRefSheetFunc, pkField) {
  var canonical = resolveCanonical_(sheetName, sheetHeadersMap);
  var isRef = isRefSheetFunc ? isRefSheetFunc(canonical) : isReferenceSheet(canonical);
  if (isRef) throw new Error('Sheet "' + canonical + '" bersifat read-only (SIMPEG), penghapusan tidak diizinkan.');
  var targetId = String(id || '').trim();
  if (!targetId) return false;
  var sh = getDb(spreadsheetId).getSheetByName(canonical);
  if (!sh) return false;
  var rowNumber = findRowNumberByPk_(sh, targetId, pkField);
  if (rowNumber === -1) return false;
  var rec = readRowByNumber_(sh, rowNumber);
  var now = nowIso();
  rec.deleted_at = now;
  rec.updated_at = now;
  rec.updated_by = (actor && (actor.id || actor.user_id)) ? (actor.id || actor.user_id) : 'system';
  var headers = sheetHeaders_(sh);
  sh.getRange(rowNumber, 1, 1, headers.length).setValues([toAlignedRow_(headers, rec)]);
  SpreadsheetApp.flush();
  invalidateSheetCache(canonical, spreadsheetId);
  return true;
}

function hardDeleteRecordNoLock(spreadsheetId, sheetName, id, actor, isRefSheetFunc, pkField) {
  var canonical = resolveCanonical_(sheetName, null);
  var isRef = isRefSheetFunc ? isRefSheetFunc(canonical) : isReferenceSheet(canonical);
  if (isRef) throw new Error('Sheet "' + canonical + '" bersifat read-only (SIMPEG), penghapusan tidak diizinkan.');
  var targetId = String(id || '').trim();
  if (!targetId) return false;
  var sh = getDb(spreadsheetId).getSheetByName(canonical);
  if (!sh) return false;
  var rowNumber = findRowNumberByPk_(sh, targetId, pkField);
  if (rowNumber === -1) return false;
  sh.deleteRow(rowNumber);
  SpreadsheetApp.flush();
  invalidateSheetCache(canonical, spreadsheetId);
  return true;
}

// ============================================================
// §11 PUBLIC API (v2.2) — wrapper tanpa underscore
// ============================================================
// Fungsi di bawah ini adalah SATU-SATUNYA pintu API untuk app konsumer.
// Panggil dari app: CoreLib.normId(x), CoreLib.parseDate(x), dst.
// ============================================================

/** Normalisasi ID/string: trim + safe null. */
function normId(v) { return normId_(v); }

/** Normalisasi string untuk perbandingan: trim + lowercase. */
function normStr(v) { return normStr_(v); }

/** Parse tanggal dari berbagai format ke Date atau null. */
function parseDate(v) { return parseDate_(v); }

/** Validasi nilai terhadap whitelist (case-insensitive). Return nilai kanonik. */
function whitelist(val, allowed, fieldName) { return whitelist_(val, allowed, fieldName); }

/** Validasi field wajib. Throw error bila ada yang kosong. */
function validateFields(obj, fields) { return validateFields_(obj, fields); }

/** Generate kode unik per sheet. */
function genUniqueCode(prefix, sheetName, field, padWidth, ssId, headersMap) {
  return genUniqueCode_(prefix, sheetName, field, padWidth, ssId, headersMap);
}

// ============================================================
// §11b UTIL PUBLIK v2.3.0 (C1, C2)
// ============================================================

/**
 * paginate_(rows, page, limit) — potong array untuk paginasi server-side.
 *
 * @param {Array} rows
 * @param {number} page — 1-indexed
 * @param {number} limit
 * @returns {Object} { success, data, meta: {total, page, limit, total_pages} }
 */
function paginate_(rows, page, limit) {
  rows  = Array.isArray(rows) ? rows : [];
  page  = parseInt(page  || 1,  10); if (isNaN(page)  || page  < 1) page  = 1;
  limit = parseInt(limit || 10, 10); if (isNaN(limit) || limit < 1) limit = 10;
  var start = (page - 1) * limit;
  return {
    success: true,
    data: rows.slice(start, start + limit),
    meta: {
      total:       rows.length,
      page:        page,
      limit:       limit,
      total_pages: Math.max(1, Math.ceil(rows.length / limit))
    }
  };
}

/**
 * matchSearch_(row, q, fields) — cek apakah ada field di `row` yang
 * mengandung substring `q` (case-insensitive). q kosong → selalu true.
 *
 * @param {Object} row
 * @param {string} q
 * @param {string[]} fields
 * @returns {boolean}
 */
function matchSearch_(row, q, fields) {
  if (!q) return true;
  var needle = String(q).toLowerCase().trim();
  if (!needle) return true;
  // Cermin setia si-lahar: field kosong/null = tidak match (bukan lolos).
  if (!Array.isArray(fields) || fields.length === 0) return false;
  for (var i = 0; i < fields.length; i++) {
    if (String((row && row[fields[i]]) || '').toLowerCase().indexOf(needle) !== -1) return true;
  }
  return false;
}

// ============================================================
// §11c PUBLIC API v2.3.0 — wrapper tanpa underscore
// ============================================================
// Fungsi berikut adalah pintu API resmi untuk app konsumer:
//   CoreLib.todayIsoLocal()
//   CoreLib.dateKey10(val)
//   CoreLib.paginate(rows, page, limit)
//   CoreLib.matchSearch(row, q, fields)
// ============================================================

/** Tanggal 'yyyy-MM-dd' hari ini menurut zona waktu Script. */
function todayIsoLocal() { return todayIsoLocal_(); }

/** Kunci tanggal 'yyyy-MM-dd' sadar zona waktu Script. */
function dateKey10(val) { return dateKey10_(val); }

/** Potong array untuk paginasi server-side. */
function paginate(rows, page, limit) { return paginate_(rows, page, limit); }

/** Cek substring case-insensitive pada beberapa field. */
function matchSearch(row, q, fields) { return matchSearch_(row, q, fields); }
