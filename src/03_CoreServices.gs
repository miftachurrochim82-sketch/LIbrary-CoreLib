// ============================================================
// CORE LIBRARY GLOBAL v2.4.0 - 03_CoreServices.gs
// Changelog v2.4.0 (2026-09-22) — C8 DRAFT:
// - ADD (C8): THEME_PRESETS_ (6 preset cermin AppCore.themes) + getThemeConfig_(store)
//   + buildThemeCss_(themeOrCode) + getThemeCss_(store) — baca THEME_JSON/THEME_CODE
//   dari ScriptProperties lalu bangun :root CSS. Dipakai Opsi B tema dinamis
//   via <app-theme-picker> + <?!= getThemeCss() ?> di Index.html.
// - Wrapper publik: getThemeConfig, buildThemeCss, getThemeCss.
// Changelog v2.3.0 (2026-09-19):
// - Sinkron rilis v2.3.0 (C1/C2/C3 ditambahkan di 01_CoreFoundation.gs).
//   Tanpa perubahan fungsional di berkas ini.
// Changelog v2.2.3 (2026-09-16):
// - Sinkron rilis v2.2.3 (fix levelOf_ ada di 02_CoreGateway). Tanpa
//   perubahan fungsional di berkas ini.
// Changelog v2.2.2 (2026-09-15):
// - Sinkron rilis v2.2.2 (perbaikan gating role ada di 02_CoreGateway).
//   Tanpa perubahan fungsional di berkas ini.
// Changelog v2.2.0 (2026-09-12):
// - saveConfigItem() menerima parameter opsional `allowedKeys`.
//   Jika di-pass, key di-lookup case-insensitive terhadap daftar ini
//   via isAllowedConfigKey_ (File 2). Jika kosong, perilaku lama
//   (tanpa whitelist) dipertahankan — backward-compat.
// - Tidak ada perubahan logic lain. File ini tidak menyentuh
//   MASTER_ROLE_LEVELS, apiGet, getHighestRole, atau lock.
// Changelog v2.1 (2026-09-12):
// - REVIEW: Tidak ada perubahan logic.
// - Hanya header changelog yang diupdate.
// Changelog v2:
// - H8: referensi DIBACA DARI MASTER (masterSsId) — tanpa salinan lokal.
// - H12: get*List gagal-loud (throw), bukan [] diam-diam.
// - H9 FIX: saveMyProfile hanya pakai actor.email + larang ganti email + revive.
// - H11 FIX: saveConfigItem menulis audit + kembalikan data.
// - H10 FIX: folder ID tersimpan-yang-rusak = ERROR (tanpa ganti diam-diam).
// - C5 FIX: executeAppSetup memakai params.props (store milik app).
// - M8/M9/M13: validasi ssId dini, warnings[] di result, cek format PLATFORM_API_URL.
// - M10: seedKonfigurasi validasi key + snapshot per iterasi.
// ============================================================

// ==================== 1. REFERENSI SIMPEG (DARI MASTER) ====================
function masterDbFor_(ssId, masterSsId) { return (masterSsId && masterSsId !== ssId) ? masterSsId : ssId; }

function getPegawaiList(ssId, headersMap, masterSsId) {
  try {
    var db = masterDbFor_(ssId, masterSsId);
    return getSheetDataCached(db, 'PEGAWAI', MASTER_SHEET_HEADERS, 600, { masterSsId: masterSsId }).map(function(p) {
      return {
        id: p.pegawai_id || p.id || '',
        pegawai_id: p.pegawai_id || p.id || '',
        nip: p.nip || '',
        nama: p.nama || '',
        email: p.email || '',
        no_hp: p.no_hp || '',
        unit_id: p.unit_id || '',
        jabatan_id: p.jabatan_id || '',
        status: p.status || 'AKTIF'
      };
    });
  } catch (err) { throw new Error('Gagal baca PEGAWAI: ' + err.message); }
}

function getUnitList(ssId, headersMap, masterSsId) {
  try {
    var db = masterDbFor_(ssId, masterSsId);
    return getSheetDataCached(db, 'UNIT_KERJA', MASTER_SHEET_HEADERS, 600, { masterSsId: masterSsId }).map(function(u) {
      return {
        unit_id: u.unit_id || u.id || '',
        kode_unit: u.kode_unit || '',
        nama_unit: u.nama_unit || '',
        parent_unit_id: u.parent_unit_id || '',
        jenis_unit: u.jenis_unit || '',
        status: u.status || 'AKTIF'
      };
    });
  } catch (err) { throw new Error('Gagal baca UNIT_KERJA: ' + err.message); }
}

function getJabatanList(ssId, headersMap, masterSsId) {
  try {
    var db = masterDbFor_(ssId, masterSsId);
    return getSheetDataCached(db, 'JABATAN', MASTER_SHEET_HEADERS, 600, { masterSsId: masterSsId }).map(function(j) {
      return {
        jabatan_id: j.jabatan_id || j.id || '',
        kode_jabatan: j.kode_jabatan || '',
        nama_jabatan: j.nama_jabatan || '',
        unit_id: j.unit_id || '',
        jenis_jabatan: j.jenis_jabatan || '',
        kelas_jabatan: j.kelas_jabatan || '',
        status: j.status || 'AKTIF',
        status_jabatan: j.status_jabatan || ''
      };
    });
  } catch (err) { throw new Error('Gagal baca JABATAN: ' + err.message); }
}

// ==================== 2. PROFIL ====================
function getProfile(ssId, email, headersMap, masterSsId) {
  if (!email) return null;
  var targetEmail = String(email).toLowerCase().trim();
  try {
    try {
      var rows = getSheetDataCached(ssId, 'MAIN_DATA', headersMap, 180);
      for (var i = 0; i < rows.length; i++) {
        var p = rows[i];
        if (!p.deleted_at && String(p.email || '').toLowerCase().trim() === targetEmail) {
          return {
            id: p.id,
            nama: p.nama || '',
            email: p.email || targetEmail,
            unit_nama: p.unit_nama || '',
            jabatan_nama: p.jabatan_nama || '',
            nip: p.nip || '',
            alamat: p.alamat || '',
            no_hp: p.no_hp || ''
          };
        }
      }
    } catch (e) { logWarn('CoreBusiness.getProfile', 'MAIN_DATA dilewati: ' + e.message); }

    var refs = getSheetDataCached(masterDbFor_(ssId, masterSsId), 'PEGAWAI', MASTER_SHEET_HEADERS, 600, { masterSsId: masterSsId });
    var referensi = null;
    for (var j = 0; j < refs.length; j++) {
      if (String(refs[j].email || '').toLowerCase().trim() === targetEmail) { referensi = refs[j]; break; }
    }
    if (!referensi) return null;

    var units = getUnitList(ssId, headersMap, masterSsId), jabatans = getJabatanList(ssId, headersMap, masterSsId);
    var unit = null, jabatan = null, k;
    for (k = 0; k < units.length; k++) { if (String(units[k].unit_id) === String(referensi.unit_id)) { unit = units[k]; break; } }
    for (k = 0; k < jabatans.length; k++) { if (String(jabatans[k].jabatan_id) === String(referensi.jabatan_id)) { jabatan = jabatans[k]; break; } }

    return {
      id: referensi.pegawai_id || referensi.id || '',
      nama: referensi.nama || '',
      email: referensi.email || targetEmail,
      unit_nama: unit ? unit.nama_unit : '',
      jabatan_nama: jabatan ? jabatan.nama_jabatan : '',
      nip: referensi.nip || '',
      alamat: referensi.alamat || '',
      no_hp: referensi.no_hp || ''
    };
  } catch (err) { logError('CoreBusiness.getProfile', err.message); return null; }
}

// H9: identitas HANYA dari session actor. data.email DIABAIKAN total.
function saveMyProfile(ssId, data, actor, headersMap, masterSsId) {
  var lock = acquireLock();
  if (!lock) return { success: false, code: 'BUSY', error: 'Server sibuk, silakan coba lagi.' };
  try {
    data = data || {};
    var email = (actor && actor.email) ? String(actor.email).toLowerCase().trim() : '';
    if (!email) return { success: false, code: 'BAD_REQUEST', error: 'Session tidak memuat email.' };

    var pegawaiLokal = readRecordsNoLock(ssId, 'MAIN_DATA', headersMap);
    var existing = null;
    for (var i = 0; i < pegawaiLokal.length; i++) {
      if (String(pegawaiLokal[i].email || '').toLowerCase().trim() === email) { existing = pegawaiLokal[i]; break; }
    }

    if (existing) {
      if (data.alamat !== undefined) existing.alamat = data.alamat;
      if (data.no_hp !== undefined) existing.no_hp = data.no_hp;
      existing.email = email;
      existing.deleted_at = ''; // revive jika sebelumnya terhapus
      var updated = writeRecordNoLock(ssId, 'MAIN_DATA', existing, true, actor, headersMap, null, 'id');
      return { success: true, data: updated };
    }

    var refs = [];
    try { refs = readRecordsNoLock(masterDbFor_(ssId, masterSsId), 'PEGAWAI', MASTER_SHEET_HEADERS, { masterSsId: masterSsId }); } catch (e) { logWarn('CoreBusiness.saveMyProfile', 'Master PEGAWAI: ' + e.message); }
    var referensi = null;
    for (var j = 0; j < refs.length; j++) {
      if (String(refs[j].email || '').toLowerCase().trim() === email) { referensi = refs[j]; break; }
    }

    var unitNama = '', jabNama = '';
    if (referensi) {
      try {
        var units = getUnitList(ssId, headersMap, masterSsId), jabatans = getJabatanList(ssId, headersMap, masterSsId), k;
        for (k = 0; k < units.length; k++) { if (String(units[k].unit_id) === String(referensi.unit_id)) { unitNama = units[k].nama_unit; break; } }
        for (k = 0; k < jabatans.length; k++) { if (String(jabatans[k].jabatan_id) === String(referensi.jabatan_id)) { jabNama = jabatans[k].nama_jabatan; break; } }
      } catch (e) {}
    }

    var created = writeRecordNoLock(ssId, 'MAIN_DATA', {
      id: makeId('main_data'),
      nama: referensi ? referensi.nama : ((actor && (actor.display_name || actor.email)) || email),
      nip: referensi ? referensi.nip : '',
      email: email,
      unit_nama: unitNama,
      jabatan_nama: jabNama,
      alamat: (data.alamat !== undefined) ? data.alamat : (referensi ? referensi.alamat : ''),
      no_hp: (data.no_hp !== undefined) ? data.no_hp : (referensi ? referensi.no_hp : ''),
      deleted_at: ''
    }, false, actor, headersMap, null, 'id');
    return { success: true, data: created };
  } catch (err) { logError('CoreBusiness.saveMyProfile', err.message); return { success: false, code: 'BAD_REQUEST', error: err.message }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

// ==================== 3. KONFIGURASI ====================
function getConfigList(ssId, headersMap) {
  try {
    return getSheetDataCached(ssId, 'KONFIGURASI', headersMap, 600).filter(function(c) { return !c.deleted_at; })
      .map(function(c) {
        return { id: c.id, key: c.key, value: c.value, keterangan: c.keterangan || '', updated_at: c.updated_at || '' };
      });
  } catch (err) { logError('CoreBusiness.getConfigList', err.message); return []; }
}

/**
 * Simpan item konfigurasi (upsert by key, case-insensitive).
 *
 * v2.2: parameter opsional `allowedKeys` — jika di-pass (array),
 * key di-lookup via isAllowedConfigKey_ (File 2). Backward-compat:
 * jika kosong, perilaku lama (tanpa whitelist) dipertahankan.
 *
 * @param {string} ssId
 * @param {Object} data - { key, value, keterangan? }
 * @param {Object} actor
 * @param {Object} headersMap
 * @param {string[]} allowedKeys - optional whitelist
 * @returns {Object}
 */
function saveConfigItem(ssId, data, actor, headersMap, allowedKeys) {
  var lock = acquireLock();
  if (!lock) return { success: false, code: 'BUSY', error: 'Server sibuk, silakan coba lagi.' };
  try {
    data = data || {};
    if (!data.key) return { success: false, code: 'BAD_REQUEST', error: 'Key konfigurasi wajib diisi.' };

    // v2.2: whitelist opsional
    if (Array.isArray(allowedKeys) && allowedKeys.length > 0) {
      var rawKey = String(data.key).trim();
      if (!isAllowedConfigKey_(rawKey, allowedKeys)) {
        return { success: false, code: 'FORBIDDEN', error: 'Key "' + rawKey + '" tidak diizinkan diubah dari sini.' };
      }
    }

    var configs = readRecordsNoLock(ssId, 'KONFIGURASI', headersMap).filter(function(c) { return !c.deleted_at; });
    var targetKey = String(data.key).trim().toLowerCase();
    var existing = null;
    for (var i = 0; i < configs.length; i++) {
      if (String(configs[i].key).trim().toLowerCase() === targetKey) { existing = configs[i]; break; }
    }
    var userId = actor && (actor.id || actor.user_id) ? (actor.id || actor.user_id) : 'system';
    var saved;
    if (existing) {
      existing.value = data.value;
      if (data.keterangan !== undefined) existing.keterangan = data.keterangan;
      existing.deleted_at = '';
      saved = writeRecordNoLock(ssId, 'KONFIGURASI', existing, true, actor, headersMap, null, 'id');
      appendAuditLog(ssId, userId, 'CONFIG_UPDATE', { key: existing.key }, headersMap);
    } else {
      saved = writeRecordNoLock(ssId, 'KONFIGURASI', {
        id: makeId('konfigurasi'),
        key: data.key,
        value: data.value,
        keterangan: data.keterangan || '',
        deleted_at: ''
      }, false, actor, headersMap, null, 'id');
      appendAuditLog(ssId, userId, 'CONFIG_CREATE', { key: data.key }, headersMap);
    }
    return { success: true, message: 'Konfigurasi berhasil disimpan.', data: saved };
  } catch (err) { logError('CoreBusiness.saveConfigItem', err.message); return { success: false, code: 'BAD_REQUEST', error: err.message }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

// ==================== 3b. TEMA DINAMIS (v2.4.0 / C8) ====================
// Cermin AppCore.themes (frontend CDN v2.9.0) — 6 preset + custom JSON.
// Disimpan di ScriptProperties: THEME_JSON (prioritas) → THEME_CODE (legacy) → 'emerald'.

var THEME_PRESETS_ = {
  emerald: { code: 'emerald', primary: '#059669', primaryDark: '#047857', primaryLight: '#ecfdf5', primaryLighter: '#d1fae5', primaryText: '#064e3b', primaryAccent: '#34d399', primaryRgb: '5, 150, 105', label: 'Emerald' },
  sky:     { code: 'sky',     primary: '#0284c7', primaryDark: '#0369a1', primaryLight: '#f0f9ff', primaryLighter: '#e0f2fe', primaryText: '#0c4a6e', primaryAccent: '#38bdf8', primaryRgb: '2, 132, 199', label: 'Sky' },
  amber:   { code: 'amber',   primary: '#d97706', primaryDark: '#b45309', primaryLight: '#fffbeb', primaryLighter: '#fef3c7', primaryText: '#78350f', primaryAccent: '#fbbf24', primaryRgb: '217, 119, 6', label: 'Amber' },
  violet:  { code: 'violet',  primary: '#7c3aed', primaryDark: '#6d28d9', primaryLight: '#f5f3ff', primaryLighter: '#ede9fe', primaryText: '#4c1d95', primaryAccent: '#a78bfa', primaryRgb: '124, 58, 237', label: 'Violet' },
  rose:    { code: 'rose',    primary: '#e11d48', primaryDark: '#be123c', primaryLight: '#fff1f2', primaryLighter: '#ffe4e6', primaryText: '#881337', primaryAccent: '#fb7185', primaryRgb: '225, 29, 72', label: 'Rose' },
  teal:    { code: 'teal',    primary: '#0d9488', primaryDark: '#0f766e', primaryLight: '#f0fdfa', primaryLighter: '#ccfbf1', primaryText: '#134e4a', primaryAccent: '#2dd4bf', primaryRgb: '13, 148, 136', label: 'Teal' }
};
var DEFAULT_THEME_CODE_ = 'emerald';

/**
 * C8 — getThemeConfig_(store)
 * Baca tema dari ScriptProperties. Urutan: THEME_JSON → THEME_CODE → default.
 * Return SELALU objek tema lengkap (tidak pernah null).
 *
 * @param {Properties} store - PropertiesService.getScriptProperties() dari APP (bukan library). Jika null, pakai library props.
 * @returns {Object} tema { code, primary, primaryDark, ... }
 */
function getThemeConfig_(store) {
  var st;
  try { st = store || PropertiesService.getScriptProperties(); } catch (e) { st = null; }
  var rawJson = st ? st.getProperty('THEME_JSON') : '';
  var rawCode = st ? st.getProperty('THEME_CODE') : '';
  // 1. Coba THEME_JSON (bisa preset code string atau JSON object)
  if (rawJson) {
    var trimmed = String(rawJson).trim();
    // Jika JSON adalah preset code string tanpa kurung, mis. "sky"
    if (THEME_PRESETS_[trimmed]) return THEME_PRESETS_[trimmed];
    // Jika JSON string diawali "{" → parse sebagai custom object
    if (trimmed.charAt(0) === '{') {
      try {
        var obj = JSON.parse(trimmed);
        if (obj && obj.primary) {
          // Merge dengan default preset untuk field yang kosong
          var base = THEME_PRESETS_[obj.code] || THEME_PRESETS_[DEFAULT_THEME_CODE_];
          return {
            code: obj.code || 'custom',
            primary: obj.primary || base.primary,
            primaryDark: obj.primaryDark || obj.primary || base.primaryDark,
            primaryLight: obj.primaryLight || base.primaryLight,
            primaryLighter: obj.primaryLighter || base.primaryLighter,
            primaryText: obj.primaryText || base.primaryText,
            primaryAccent: obj.primaryAccent || base.primaryAccent,
            primaryRgb: obj.primaryRgb || base.primaryRgb,
            label: obj.label || base.label
          };
        }
      } catch (e) { /* fallthrough */ }
    }
    // Jika trimmed adalah code valid tapi tersimpan sebagai JSON string quote
    try {
      var parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string' && THEME_PRESETS_[parsed]) return THEME_PRESETS_[parsed];
    } catch (e) {}
  }
  // 2. Fallback THEME_CODE legacy
  if (rawCode && THEME_PRESETS_[String(rawCode).trim()]) return THEME_PRESETS_[String(rawCode).trim()];
  // 3. Default
  return THEME_PRESETS_[DEFAULT_THEME_CODE_];
}

/**
 * C8 — buildThemeCss_(themeOrCode)
 * Bangun CSS :root untuk inject di Index.html (<?!= getThemeCss() ?>) atau via JS.
 *
 * @param {Object|string} themeOrCode - objek tema atau code string
 * @returns {string} CSS string
 */
function buildThemeCss_(themeOrCode) {
  var t = null;
  if (typeof themeOrCode === 'string') t = THEME_PRESETS_[themeOrCode] || getThemeConfig_();
  else if (themeOrCode && typeof themeOrCode === 'object' && themeOrCode.primary) t = themeOrCode;
  else t = getThemeConfig_();
  return ':root{'
    + '--primary:' + t.primary + ';'
    + '--primary-dark:' + (t.primaryDark || t.primary) + ';'
    + '--primary-light:' + t.primaryLight + ';'
    + '--primary-lighter:' + t.primaryLighter + ';'
    + '--primary-text:' + t.primaryText + ';'
    + '--primary-accent:' + t.primaryAccent + ';'
    + '--primary-rgb:' + t.primaryRgb + ';'
    + '}';
}

/**
 * C8 — getThemeCss_(store)
 * Helper untuk dipanggil dari template HTML: <?!= getThemeCss() ?>
 * Membaca config dari store app lalu bangun CSS.
 */
function getThemeCss_(store) {
  return buildThemeCss_(getThemeConfig_(store));
}

// ==================== 4. PROVISIONING ====================
// H10: ID tersimpan-yang-rusak = ERROR (jangan ganti diam-diam). ID kosong = buat baru.
function ensureDriveFolder(folderId, folderName, parentFolder) {
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); }
    catch (e) { throw new Error('Folder tersimpan "' + folderName + '" (ID: ' + folderId + ') tidak bisa dibuka: ' + e.message + '. Relink manual diperlukan — folder TIDAK diganti otomatis.'); }
  }
  return parentFolder ? parentFolder.createFolder(folderName) : DriveApp.createFolder(folderName);
}

// Kembalikan warnings[] + cek master bila masterSsId diisi.
function checkReferenceSheets(ssId, refSheetsArray, masterSsId) {
  var warnings = [];
  var db = masterDbFor_(ssId, masterSsId);
  var required = refSheetsArray || MASTER_REFERENCE_SHEETS;
  required.forEach(function(sheetName) {
    var sh = null;
    try { sh = getDb(db).getSheetByName(sheetName); } catch (e) { sh = null; }
    if (!sh) {
      var w1 = 'Sheet referensi "' + sheetName + '" TIDAK ADA di ' + (masterSsId ? 'MASTER' : 'DB lokal') + '.';
      warnings.push(w1);
      logWarn('CoreSetup', w1);
    } else if (sh.getLastColumn() === 0 || sh.getLastRow() < 2) {
      var w2 = 'Sheet "' + sheetName + '" kosong (tanpa data).';
      warnings.push(w2);
      logWarn('CoreSetup', w2);
    } else {
      logInfo('CoreSetup', 'Sheet referensi "' + sheetName + '" siap (' + (sh.getLastRow() - 1) + ' data).');
    }
  });
  return warnings;
}

function seedKonfigurasi(ssId, defaultConfigs, headersMap) {
  var configs = readRecordsNoLock(ssId, 'KONFIGURASI', headersMap);
  var existingKeys = {};
  configs.filter(function(c) { return !c.deleted_at; }).forEach(function(c) { existingKeys[String(c.key).trim().toLowerCase()] = true; });
  var added = 0;
  (defaultConfigs || []).forEach(function(cfg) {
    if (!cfg || !cfg.key) { logWarn('CoreSetup', 'Seed konfigurasi tanpa key dilewati.'); return; }
    var k = String(cfg.key).trim().toLowerCase();
    if (!existingKeys[k]) {
      writeRecordNoLock(ssId, 'KONFIGURASI', {
        id: makeId('konfigurasi'),
        key: cfg.key,
        value: cfg.value,
        keterangan: cfg.keterangan || '',
        deleted_at: ''
      }, false, systemActor(), headersMap, null, 'id');
      existingKeys[k] = true;
      added++;
    }
  });
  logInfo('CoreSetup', added > 0 ? ('Total ' + added + ' konfigurasi baru ditambahkan.') : 'Konfigurasi default lengkap.');
  return added;
}

// C5: props WAJIB dioper dari kode aplikasi (params.props).
function resolveProps_(params) {
  if (params.props) return params.props;
  logError('CoreSetup', '⛔ params.props TIDAK dioper! Properti akan tertulis ke store LIBRARY (dipakai bersama). Oper PropertiesService.getScriptProperties() dari kode aplikasi.');
  return PropertiesService.getScriptProperties();
}

function getThemeConfig(store) { return getThemeConfig_(store); }
function buildThemeCss(themeOrCode) { return buildThemeCss_(themeOrCode); }
function getThemeCss(store) { return getThemeCss_(store); }

function executeAppSetup(params) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, code: 'BUSY', error: 'Proses setup lain sedang berjalan. Silakan coba lagi.' };
  try {
    params = params || {};
    var appCode = params.appCode || 'APP';
    var appTitle = params.appTitle || 'Web Application';
    var ssId = params.spreadsheetId || '';
    if (!ssId) {
      var active = null;
      try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { active = null; }
      if (active) ssId = active.getId();
    }
    if (!ssId) return { success: false, code: 'BAD_REQUEST', error: 'spreadsheetId wajib diisi (tidak ada spreadsheet aktif).' };
    try { getDb(ssId).getName(); } catch (e) { return { success: false, code: 'BAD_REQUEST', error: 'Database tidak bisa dibuka: ' + e.message }; }
    if (params.platformApiUrl && String(params.platformApiUrl).indexOf('/exec') === -1) {
      return { success: false, code: 'BAD_REQUEST', error: 'platformApiUrl harus URL /exec production (bukan /dev).' };
    }
    var headersMap = params.headersMap || {};
    var props = resolveProps_(params);
    props.setProperty('APP_CODE', appCode);
    props.setProperty('SPREADSHEET_ID', ssId);
    if (params.masterSsId) props.setProperty('MASTER_SPREADSHEET_ID', params.masterSsId);
    if (params.platformApiUrl) props.setProperty('PLATFORM_API_URL', params.platformApiUrl);
    var rootFolder = ensureDriveFolder(props.getProperty('ROOT_FOLDER_ID'), appTitle + ' Folder');
    props.setProperty('ROOT_FOLDER_ID', rootFolder.getId());
    var evidenceFolder = ensureDriveFolder(props.getProperty('EVIDENCE_FOLDER_ID'), 'Evidence', rootFolder);
    props.setProperty('EVIDENCE_FOLDER_ID', evidenceFolder.getId());
    var backupFolder = ensureDriveFolder(props.getProperty('BACKUP_FOLDER_ID'), 'Backup', rootFolder);
    props.setProperty('BACKUP_FOLDER_ID', backupFolder.getId());
    initDatabase(ssId, headersMap, params.isRefSheetFunc);
    var warnings = checkReferenceSheets(ssId, MASTER_REFERENCE_SHEETS, params.masterSsId);
    seedKonfigurasi(ssId, params.defaultConfigs || [], headersMap);
    logInfo('CoreSetup', 'Setup aplikasi ' + appTitle + ' selesai.');
    return {
      success: true,
      message: 'Setup aplikasi ' + appTitle + ' berhasil!',
      warnings: warnings,
      folders: { root: rootFolder.getId(), evidence: evidenceFolder.getId(), backup: backupFolder.getId() }
    };
  } catch (err) { logError('CoreSetup', 'Setup gagal: ' + err.message); return { success: false, code: 'BAD_REQUEST', error: err.message }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}
