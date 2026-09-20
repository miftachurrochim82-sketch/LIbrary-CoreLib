// ============================================================
// CORE LIBRARY GLOBAL v2.3.0 - 02_CoreGateway.gs
// Changelog v2.3.0 (2026-09-19):
// - Sinkron rilis v2.3.0 (C1/C2/C3 ditambahkan di 01_CoreFoundation.gs).
//   Tanpa perubahan fungsional di berkas ini.
// Changelog v2.2.3 (2026-09-16):
// - FIX KEAMANAN (P1-C1 TUNTAS): levelOf_ — fallback `|| 1` ternyata BELUM
//   diganti saat v2.2.2 (changelog mengklaim sudah). viewer (level 0, falsy)
//   & role tak dikenal tetap naik ke 1 → bisa lolos gerbang save/delete
//   'user' di Declarative Resource Router & entityPermissions write='user'.
//   Sekarang: undefined → 0 (fail-closed), selaras checkAuth & requireRole_.
// Changelog v2.2.2 (2026-09-15):
// - FIX KEAMANAN (P1-C1): checkAuth & levelOf_ — fallback `|| 1` diganti pola
//   `=== undefined → 0` (selaras requireRole_). Sejak MASTER_ROLE_LEVELS v2.2
//   viewer=0 (falsy), fallback lama menaikkan level efektif viewer & role tak
//   dikenal menjadi 1: viewer bisa save/update, akses list/detail viewer
//   justru selalu FORBIDDEN, dan role typo lolos (fail-open).
// - FIX: dispatchAction menghapus data._cacheBust (cache buster app-core
//   v2.5.1) sebelum diproses + extractRecord mengecualikannya — sesuai
//   kontrak changelog app-core v2.5.1 (cegah kolom _cacheBust tercipta).
// Changelog v2.2.0 (2026-09-12):
// - AUTHZ PUBLIK BARU (dipanggil app via CoreLib.xxx):
//     requireRole_(user, minRole, customLevels)     — throw bila kurang
//     checkRole_(user, action, actionRoleMap)       — {allowed, minRole, error}
//     getRoleForEmail_(email, store)                — 'admin'|'verifikator'|'viewer'
// - CONFIG KEY WHITELIST BARU:
//     ALLOWED_CONFIG_KEYS_                          — daftar default
//     isAllowedConfigKey_(key, extraKeys)           — app bisa pass extraKeys
//     ⚠ ADMIN_EMAILS/VERIFIKATOR_EMAILS DIHAPUS dari default demi keamanan
//        (cegah privilege escalation via UI). App yang butuh, extend sendiri.
// - PUBLIC API WRAPPER (tanpa underscore untuk konsumsi app):
//     requireRole, checkRole, getRoleForEmail, isAllowedConfigKey
// - P1-B1 FIX: appendAuditLog invalidate cache AUDIT_LOGS setelah append.
//              Sebelumnya pembaca AUDIT_LOGS via cache dapat data basi.
// - P1-B5 FIX: handleDeclarativeResourceAction_ konsisten meneruskan
//              masterSsId ke executeResourceList_ dan getSheetDataCached
//              (isDetail). Sebelumnya bergantung pada ssId-switch implisit.
// Changelog v2.1 (2026-09-12):
// - P1-B1 FIX: getHighestRole() mengembalikan 5 level kanonik.
// - P1-B2 FIX: apiGet() menerima parameter opsional masterSsId.
// - P1-B3 FIX: 'save_my_profile' default level 'viewer' (self-service).
// Changelog v2:
// - C1 FIX: binding appCode tiket vs config (assertTicketBinding_).
// - C2 FIX: prefix session unik per app (sessionPrefixFor_).
// - C3 FIX: testMode DIHAPUS TOTAL.
// - C4 FIX: TTL session di-cap 21600.
// - H1 FIX: tabel role Global->library standar + customLevels.
// - H2 FIX: pegawai_id/nip di-resolve dari master by email.
// - H3 FIX: allowlist entitas + entityPermissions per tabel.
// - H4 FIX: apiSave menghapus paksa field audit client.
// - H5 FIX: AUDIT_LOGS via header default sistem + details dipotong 40rb.
// - H6/H7 FIX: apiSave 1x-scan (upsertRow_ langsung).
// - BARU: Declarative Resource Routing (Auto-CRUD with Row-Level Security,
//         Multi-Field Search, CacheService acceleration, Hooks & Permissions).
// - BARU: case 'save_config_item'; actionLevels kustom; kode error standar.
// ============================================================

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function extractRecord(data) {
  if (!data) return {};
  if (data.record) return data.record;
  if (data.row) return data.row;
  var record = {};
  Object.keys(data).forEach(function(key) {
    if (['entity', 'sheetName', 'table', 'token', 'action', 'id', 'page', 'limit', 'filters', 'search', 'sortBy', 'sortDir', 'sortOrder', '_cacheBust'].indexOf(key) === -1) record[key] = data[key];
  });
  if (data.id !== undefined && record.id === undefined) record.id = data.id;
  return record;
}

// ============================================================
// §1 SSO
// ============================================================

// testMode DIHAPUS (argumen ke-3 diabaikan demi kompatibilitas signature).
function validatePlatformTicket(ticket, platformApiUrl, testMode, appCode) {
  if (testMode) logError('CoreAuth', '⛔ testMode telah DIHAPUS. Validasi memakai server SSO asli.');
  var cleanTicket = String(ticket || '').trim();
  if (!cleanTicket) throw new Error('Tiket platform SSO tidak dilampirkan atau kosong.');
  if (!platformApiUrl) throw new Error('PLATFORM_API_URL belum dikonfigurasi.');
  var payload = { method: 'POST', path: '/api/v1/auth/validate-ticket', data: { ticket: cleanTicket, appCode: appCode || '' } };
  var response = UrlFetchApp.fetch(platformApiUrl, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true, followRedirects: true });
  var code = response.getResponseCode(), text = response.getContentText();
  if (code !== 200) { logError('CoreAuth', 'HTTP Error ' + code + ': ' + text.slice(0, 300)); throw new Error('Gagal validasi tiket SSO (HTTP ' + code + ').'); }
  var result;
  try { result = JSON.parse(text); } catch (e) { throw new Error('Respon SSO bukan JSON valid: ' + text.substring(0, 100)); }
  if (!result.success || !result.data || !result.data.user) throw new Error((result.error && result.error.message) ? result.error.message : 'Tiket SSO tidak valid/kadaluwarsa.');
  return result.data;
}

// C1: tiket harus milik aplikasi ini.
function assertTicketBinding_(ticketApp, configApp) {
  if (ticketApp && configApp && String(ticketApp) !== String(configApp)) throw new Error('Tiket diterbitkan untuk aplikasi lain (' + ticketApp + ').');
}

// C2: SATU-SATUNYA sumber prefix session. appCode berbeda = namespace berbeda.
function sessionPrefixFor_(config) {
  config = config || {};
  if (config.sessionPrefix) return config.sessionPrefix;
  return 'APP_SESSION_' + (config.appCode || 'DEFAULT') + '_';
}

// H2 murni (testable): cocokkan email -> identitas pegawai dari baris master.
function resolvePegawaiFromRows_(rows, email) {
  var target = String(email || '').toLowerCase().trim();
  var out = { pegawai_id: '', nip: '', nama: '' };
  if (!target || !Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].email || '').toLowerCase().trim() === target) {
      out.pegawai_id = rows[i].pegawai_id || rows[i].id || '';
      out.nip = rows[i].nip || '';
      out.nama = rows[i].nama || '';
      break;
    }
  }
  return out;
}

function resolvePegawaiByEmail_(email, masterSsId) {
  var empty = { pegawai_id: '', nip: '', nama: '' };
  if (!email || !masterSsId) return empty;
  try {
    return resolvePegawaiFromRows_(getSheetDataCached(masterSsId, 'PEGAWAI', MASTER_SHEET_HEADERS, 600, { masterSsId: masterSsId }), email);
  } catch (e) { logError('CoreAuth', 'Resolve pegawai gagal: ' + e.message); return empty; }
}

function exchangePlatformTicket(ticket, config) {
  try {
    config = config || {};
    if (config.testMode) { logError('CoreAuth', '⛔ testMode telah DIHAPUS. Exchange ditolak.'); return { success: false, code: 'FORBIDDEN', error: 'Test mode dihapus. Gunakan tiket SSO asli.' }; }
    var cleanTicket = String(ticket || '').trim();
    if (!cleanTicket) throw new Error('Tiket SSO wajib dilampirkan.');
    var prefix = sessionPrefixFor_(config);
    var ttl = capTtl_(config.ttlSeconds || 28800); // C4: cap 21600
    var platformData = validatePlatformTicket(cleanTicket, config.platformApiUrl, false, config.appCode);
    assertTicketBinding_(platformData.appCode, config.appCode); // C1
    var platformUser = platformData.user || {};
    var email = String(platformUser.email || '').toLowerCase().trim();
    if (!email) throw new Error('Email pengguna tidak ditemukan dalam respon tiket SSO.');
    var roles = Array.isArray(platformUser.roles) ? platformUser.roles.map(String) : [];
    var role = getHighestRole(roles, config.roleLevels);
    var ident = resolvePegawaiByEmail_(email, config.masterSsId); // H2: tanpa fabrikasi
    var localToken = Utilities.getUuid();
    var payload = {
      user_id: platformUser.id || platformUser.user_id || email,
      email: email,
      role: role,
      pegawai_id: ident.pegawai_id,
      nip: ident.nip,
      display_name: platformUser.display_name || platformUser.nama || platformUser.name || ident.nama || email
    };
    CacheService.getScriptCache().put(prefix + localToken, JSON.stringify(payload), ttl);
    logInfo('CoreAuth', 'Penukaran tiket SSO berhasil: ' + email + ' [' + role + ']');
    return { success: true, data: { token: localToken, user: payload } };
  } catch (err) { logError('CoreAuth', err.message); return { success: false, code: 'UNAUTHORIZED', error: err.message }; }
}

// ============================================================
// §2 SESSION
// ============================================================

function logoutUser(token, sessionPrefix) {
  if (!token) return { success: false, code: 'BAD_REQUEST', error: 'Token sesi wajib diisi.' };
  CacheService.getScriptCache().remove((sessionPrefix || 'APP_SESSION_DEFAULT_') + token);
  return { success: true, message: 'Berhasil keluar dari aplikasi.' };
}

function checkAuth(token, minLevel, sessionPrefix, customRoleLevels) {
  try {
    if (!token) return { success: false, code: 'UNAUTHORIZED', error: 'Token sesi tidak ditemukan. Silakan login kembali.' };
    var raw = CacheService.getScriptCache().get((sessionPrefix || 'APP_SESSION_DEFAULT_') + token);
    if (!raw) return { success: false, code: 'UNAUTHORIZED', error: 'Sesi telah kadaluwarsa. Silakan login kembali.' };
    var session = JSON.parse(raw);
    var roleMap = customRoleLevels || MASTER_ROLE_LEVELS;
    var userRole = String(session.role || 'viewer').toLowerCase();
    // v2.2.2 FIX (P1-C1): sejak v2.2 viewer berlevel 0 (falsy). Fallback lama
    // `|| 1` menaikkan viewer & role tak dikenal ke level 1 → viewer bisa
    // save/update, sementara syarat 'viewer' (0) menjadi 1 sehingga akses
    // baca justru selalu tertolak. Sekarang: undefined → 0 (fail-closed),
    // selaras dengan requireRole_.
    var currentLevel = roleMap[userRole];
    if (currentLevel === undefined) currentLevel = 0;
    var requiredLevel = (typeof minLevel === 'number') ? minLevel : roleMap[String(minLevel).toLowerCase()];
    if (requiredLevel === undefined) requiredLevel = 0;
    if (currentLevel < requiredLevel) return { success: false, code: 'FORBIDDEN', error: 'Akses ditolak. Butuh hak akses minimal "' + minLevel + '".' };
    return {
      success: true,
      token: token,
      user: {
        id: session.user_id,
        email: session.email,
        role: userRole,
        pegawai_id: session.pegawai_id || '',
        nip: session.nip || '',
        display_name: session.display_name || session.email || ''
      }
    };
  } catch (err) { logError('CoreAuth', err.message); return { success: false, code: 'UNAUTHORIZED', error: err.message }; }
}

// ============================================================
// §3 ROLE MAPPING
// ============================================================

// P1-B1 (v2.1): Mapping role dari SI-PLATFORM ke 5 level kanonik CoreLib.
// - Level 0 (viewer)      : viewer, tamu
// - Level 1 (user)        : user, pegawai, operator, auditor, bendahara, staf, pelaksana
// - Level 2 (verifikator) : verifikator, kasubbag, kasi
// - Level 3 (admin)       : admin, administrator, kasat, kabid, sekretaris, kepala_dinas
// - Level 4 (super)       : super, superadmin
// customLevels di-merge menimpa default.
var ROLE_LEVELS_MAP_ = {
  viewer: 0, tamu: 0,
  user: 1, pegawai: 1, operator: 1, auditor: 1, bendahara: 1, staf: 1, pelaksana: 1,
  verifikator: 2, kasubbag: 2, kasi: 2,
  admin: 3, administrator: 3, kasat: 3, kabid: 3, sekretaris: 3, kepala_dinas: 3,
  super: 4, superadmin: 4
};

// Mapping eksplisit role apapun -> canonical (5 level)
var ROLE_TO_CANONICAL_ = {
  viewer: 'viewer', tamu: 'viewer',
  user: 'user', pegawai: 'user', operator: 'user', auditor: 'user', bendahara: 'user', staf: 'user', pelaksana: 'user',
  verifikator: 'verifikator', kasubbag: 'verifikator', kasi: 'verifikator',
  admin: 'admin', administrator: 'admin', kasat: 'admin', kabid: 'admin', sekretaris: 'admin', kepala_dinas: 'admin',
  super: 'super', superadmin: 'super'
};

// Prioritas canonical saat level sama (mis. viewer vs user, dua-duanya lv=1... 
// tapi di v2.1 viewer=0, user=1 jadi tidak bentrok. Dijaga untuk safety kalau
// custom level bentrok).
var CANONICAL_PRIORITY_ = { viewer: 1, user: 2, verifikator: 3, admin: 4, super: 5 };

function getHighestRole(roles, customLevels) {
  var roleLevels = {};
  Object.keys(ROLE_LEVELS_MAP_).forEach(function(k) { roleLevels[k] = ROLE_LEVELS_MAP_[k]; });
  if (customLevels) Object.keys(customLevels).forEach(function(k) { roleLevels[String(k).toLowerCase()] = customLevels[k]; });

  if (!roles || !Array.isArray(roles) || roles.length === 0) return 'viewer';

  var highestLevel = 0;
  var highestPriority = 0;
  var canonicalRole = 'viewer';

  roles.forEach(function(r) {
    var rl = String(r).toLowerCase().trim();
    var lv = roleLevels[rl];
    if (lv === undefined) lv = 1;
    var canon = ROLE_TO_CANONICAL_[rl] || 'viewer';
    var pri = CANONICAL_PRIORITY_[canon] || 1;

    if (lv > highestLevel || (lv === highestLevel && pri > highestPriority)) {
      highestLevel = lv;
      highestPriority = pri;
      canonicalRole = canon;
    }
  });
  return canonicalRole;
}

// ============================================================
// §4 AUTHZ PUBLIK BARU (v2.2)
// ============================================================

/**
 * Validasi role user terhadap minRole. Throw bila tidak cukup.
 *
 * @param {Object} user - { role: 'viewer'|'user'|'verifikator'|'admin'|'super' }
 * @param {string} minRole
 * @param {Object} customLevels - optional, override map level
 * @throws {Error} bila user.role < minRole
 * @returns {boolean} true bila lolos
 */
function requireRole_(user, minRole, customLevels) {
  var roleMap = customLevels || MASTER_ROLE_LEVELS;
  var userRole = String((user && user.role) || 'viewer').toLowerCase();
  var userLevel = roleMap[userRole];
  var needLevel = roleMap[String(minRole).toLowerCase()];
  if (userLevel === undefined) userLevel = 0;
  if (needLevel === undefined) needLevel = 0;
  if (userLevel < needLevel) {
    throw new Error('Akses ditolak: butuh role minimal "' + minRole + '".');
  }
  return true;
}

/**
 * Cek apakah user boleh melakukan action menurut actionRoleMap.
 * actionRoleMap: { actionName: minRole, ... }
 *
 * Return:
 *   { allowed: true,  minRole: 'admin' }                     — boleh
 *   { allowed: true,  minRole: null }                        — action tidak di-map = bebas
 *   { allowed: false, minRole: 'admin', error: 'Akses...' }  — ditolak
 *
 * @param {Object} user
 * @param {string} action
 * @param {Object} actionRoleMap
 * @returns {Object}
 */
function checkRole_(user, action, actionRoleMap) {
  if (!actionRoleMap || !actionRoleMap[action]) {
    return { allowed: true, minRole: null };
  }
  var minRole = actionRoleMap[action];
  try {
    requireRole_(user, minRole);
    return { allowed: true, minRole: minRole };
  } catch (e) {
    return { allowed: false, minRole: minRole, error: e.message };
  }
}

/**
 * Tentukan role dari email via whitelist di Script Properties.
 * App harus set ADMIN_EMAILS & VERIFIKATOR_EMAILS (pisahkan dengan koma).
 *
 * @param {string} email
 * @param {Properties} store - WAJIB dari kode app (bukan library),
 *                             kecuali app memang simpan di library props.
 * @returns {string} 'admin' | 'verifikator' | 'viewer'
 */
function getRoleForEmail_(email, store) {
  if (!email) return 'viewer';
  var e = String(email).toLowerCase().trim();
  var st;
  try {
    st = store || PropertiesService.getScriptProperties();
  } catch (err) { return 'viewer'; }

  var adminEmails = String(st.getProperty('ADMIN_EMAILS') || '').toLowerCase();
  var verifEmails = String(st.getProperty('VERIFIKATOR_EMAILS') || '').toLowerCase();

  if (adminEmails) {
    var adm = adminEmails.split(',').map(function(x) { return x.trim(); });
    if (adm.indexOf(e) !== -1) return 'admin';
  }
  if (verifEmails) {
    var vrf = verifEmails.split(',').map(function(x) { return x.trim(); });
    if (vrf.indexOf(e) !== -1) return 'verifikator';
  }
  return 'viewer';
}

// ============================================================
// §5 CONFIG KEY WHITELIST BARU (v2.2)
// ============================================================

// Daftar default key config yang boleh diubah dari UI.
// ⚠ ADMIN_EMAILS & VERIFIKATOR_EMAILS SENGAJA TIDAK ADA DI SINI — 
//    mencegah privilege escalation lewat UI. App yang memang butuh
//    mengelola whitelist email via UI harus pass extraKeys eksplisit
//    (dengan kesadaran risikonya).
var ALLOWED_CONFIG_KEYS_ = [
  'app_title',
  'app_version',
  'instansi',
  'target_jp_pns',
  'target_jp_pppk',
  'tahun_evaluasi_aktif',
  'alert_h_days_lisensi',
  'auto_approve_sertifikat',
  'max_pdf_upload_mb'
];

/**
 * Cek apakah key config boleh diubah dari UI.
 * @param {string} key
 * @param {string[]} extraKeys - optional, tambahan dari app
 * @returns {boolean}
 */
function isAllowedConfigKey_(key, extraKeys) {
  var k = String(key);
  if (ALLOWED_CONFIG_KEYS_.indexOf(k) !== -1) return true;
  if (Array.isArray(extraKeys) && extraKeys.indexOf(k) !== -1) return true;
  return false;
}

// ============================================================
// §6 CRUD HANDLERS
// ============================================================

// P1-B2 (v2.1): masterSsId opsional di akhir. Sheet referensi (PEGAWAI/JABATAN/UNIT_KERJA)
// otomatis dibaca dari master lewat getSheetDataCached (opsi.masterSsId).
function apiGet(ssId, sheetName, id, query, headersMap, pkField, masterSsId) {
  try {
    query = query || {};
    var canonical = String(sheetName || '').toUpperCase().trim();
    if (!canonical) return { success: false, code: 'BAD_REQUEST', error: 'Nama sheet tidak valid.' };
    var rows = getSheetDataCached(ssId, canonical, headersMap, 180, { masterSsId: masterSsId }).filter(function(row) { return !row.deleted_at; });
    var headers = (headersMap && headersMap[canonical]) ? headersMap[canonical] : [];
    if (id) {
      var found = null;
      for (var i = 0; i < rows.length; i++) {
        if (String(getRecordPrimaryId_(rows[i], pkField)) === String(id)) { found = rows[i]; break; }
      }
      return { success: true, data: found };
    }
    if (query.filters) {
      var filters = (typeof query.filters === 'string') ? JSON.parse(query.filters) : query.filters;
      Object.keys(filters).forEach(function(key) {
        var val = filters[key];
        if (val !== '' && val !== null && val !== undefined) rows = rows.filter(function(row) { return String(row[key] || '').toLowerCase() === String(val).toLowerCase(); });
      });
    }
    if (query.search) {
      var q = String(query.search).toLowerCase().trim();
      if (q) {
        var fields = headers.length > 0 ? headers : (rows.length > 0 ? Object.keys(rows[0]) : []);
        rows = rows.filter(function(row) { return fields.some(function(h) { return String(row[h] || '').toLowerCase().indexOf(q) !== -1; }); });
      }
    }
    if (query.sortBy) {
      var sortDir = String(query.sortDir || query.sortOrder || 'asc').toLowerCase() === 'desc' ? -1 : 1;
      rows.sort(function(a, b) { var av = a[query.sortBy] || '', bv = b[query.sortBy] || ''; return (av < bv ? -1 : (av > bv ? 1 : 0)) * sortDir; });
    }
    var page = parseInt(query.page, 10); if (isNaN(page) || page < 1) page = 1;
    var limit = parseInt(query.limit, 10); if (isNaN(limit) || limit < 1) limit = 50; if (limit > 500) limit = 500;
    var total = rows.length, start = (page - 1) * limit;
    return { success: true, data: rows.slice(start, start + limit), meta: { total: total, page: page, limit: limit, total_pages: Math.max(1, Math.ceil(total / limit)) } };
  } catch (err) { logError('CoreHandlers.apiGet', err.message); return { success: false, code: 'BAD_REQUEST', error: err.message }; }
}

function apiSave(ssId, sheetName, record, actor, headersMap, isRefSheetFunc, preSaveHook, pkField) {
  var lock = acquireLock();
  if (!lock) return { success: false, code: 'BUSY', error: 'Server sibuk, silakan coba lagi.' };
  try {
    var canonical = resolveCanonical_(sheetName, headersMap);
    var isRef = isRefSheetFunc ? isRefSheetFunc(canonical) : isReferenceSheet(canonical);
    if (isRef) return { success: false, code: 'FORBIDDEN', error: 'Sheet referensi SIMPEG bersifat read-only.' };
    if (!record || typeof record !== 'object') return { success: false, code: 'BAD_REQUEST', error: 'Payload record tidak valid.' };
    record = Object.assign({}, record);
    ['created_at', 'created_by', 'updated_at', 'updated_by', 'deleted_at'].forEach(function(f) { delete record[f]; }); // H4: otoritas server
    if (typeof preSaveHook === 'function') {
      var hookResult = preSaveHook(canonical, record, actor);
      if (hookResult && hookResult.error) return { success: false, code: 'BAD_REQUEST', error: hookResult.error };
      if (hookResult && hookResult.record) record = hookResult.record;
    }
    var r = resolveHeaders_(canonical, headersMap, record);
    var sh = ensureSheet(ssId, canonical, headersMap, { isRefFunc: isRefSheetFunc });
    var out = upsertRow_(sh, record, actor, pkField, null);
    invalidateSheetCache(canonical, ssId);
    var userId = actor && (actor.id || actor.user_id) ? (actor.id || actor.user_id) : 'system';
    appendAuditLog(ssId, userId, (out.isUpdate ? 'UPDATE_' : 'INSERT_') + canonical, out.record, headersMap);
    return { success: true, data: out.record };
  } catch (err) { logError('CoreHandlers.apiSave', err.message); return { success: false, code: 'BAD_REQUEST', error: err.message }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

function apiDelete(ssId, sheetName, id, actor, headersMap, isRefSheetFunc, pkField) {
  var lock = acquireLock();
  if (!lock) return { success: false, code: 'BUSY', error: 'Server sibuk, silakan coba lagi.' };
  try {
    var canonical = resolveCanonical_(sheetName, headersMap);
    var isRef = isRefSheetFunc ? isRefSheetFunc(canonical) : isReferenceSheet(canonical);
    if (isRef) return { success: false, code: 'FORBIDDEN', error: 'Sheet referensi SIMPEG bersifat read-only.' };
    if (!id) return { success: false, code: 'BAD_REQUEST', error: 'ID record wajib diisi.' };
    var userId = actor && (actor.id || actor.user_id) ? (actor.id || actor.user_id) : 'system';
    if (canonical === 'KONFIGURASI') {
      if (!hardDeleteRecordNoLock(ssId, canonical, id, actor, isRefSheetFunc, pkField)) return { success: false, code: 'NOT_FOUND', error: 'Data konfigurasi tidak ditemukan.' };
      appendAuditLog(ssId, userId, 'HARD_DELETE_' + canonical, 'Hard delete ID: ' + id, headersMap);
      return { success: true, message: 'Konfigurasi dihapus permanen.' };
    }
    if (!softDeleteRecordNoLock(ssId, canonical, id, actor, headersMap, isRefSheetFunc, pkField)) return { success: false, code: 'NOT_FOUND', error: 'Record tidak ditemukan.' };
    appendAuditLog(ssId, userId, 'DELETE_' + canonical, 'Soft delete ID: ' + id, headersMap);
    return { success: true, message: 'Data berhasil dihapus.' };
  } catch (err) { logError('CoreHandlers.apiDelete', err.message); return { success: false, code: 'BAD_REQUEST', error: err.message }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

// P1-B1 (v2.2): invalidate cache AUDIT_LOGS setelah append.
function appendAuditLog(ssId, userId, action, details, headersMap) {
  try {
    var det = (typeof details === 'object') ? JSON.stringify(details) : String(details || '');
    if (det.length > 40000) det = det.slice(0, 40000) + '…[truncated]';
    var sh = ensureSheet(ssId, 'AUDIT_LOGS', headersMap || {}, {});
    var headers = sheetHeaders_(sh);
    if (headers.length === 0) {
      headers = DEFAULT_SYSTEM_HEADERS.AUDIT_LOGS.slice();
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
    sh.appendRow(toAlignedRow_(headers, { id: makeId('audit'), user_id: userId || 'system', action: action || 'UNKNOWN', timestamp: nowIso(), details: det }));
    // P1-B1 (v2.2): invalidate cache setelah append
    invalidateSheetCache('AUDIT_LOGS', ssId);
  } catch (e) { logError('CoreHandlers.appendAuditLog', e.message); }
}

// ============================================================
// §7 DECLARATIVE RESOURCE ROUTER
// ============================================================

function handleDeclarativeResourceAction_(action, data, currentUser, localConfig) {
  var resources = localConfig.resources;
  if (!resources || typeof resources !== 'object') return null;

  var act = String(action || '').toLowerCase().trim();
  var resourceKeys = Object.keys(resources);

  for (var i = 0; i < resourceKeys.length; i++) {
    var rKey = resourceKeys[i];
    var resCfg = resources[rKey] || {};
    var normKey = String(rKey).toLowerCase().trim();
    var canonical = String(resCfg.sheetName || rKey).toUpperCase().trim();
    var pkField = resCfg.pk || pkFor_(localConfig, canonical) || 'id';
    var ownerField = resCfg.ownerField || null;
    var searchFields = resCfg.searchFields || null;
    var roles = resCfg.roles || {};
    var hooks = resCfg.hooks || {};
    var roleMap = localConfig.roleLevels || MASTER_ROLE_LEVELS;
    var ssId = (isReferenceSheet(canonical) && localConfig.masterSsId) ? localConfig.masterSsId : localConfig.spreadsheetId;
    var headersMap = localConfig.headersMap;
    var userRole = String((currentUser && currentUser.role) || 'viewer').toLowerCase();
    var userLevel = levelOf_(userRole, roleMap);
    var isAdmin = userRole === 'admin' || userRole === 'super';
    var userPegawaiId = String((currentUser && (currentUser.pegawai_id || currentUser.user_id || currentUser.id)) || '').trim();

    // Match Action Patterns (supports snake_case and dot.notation)
    var isList = (act === 'get_' + normKey + '_list' || act === 'get_' + normKey + 's' || act === 'get_' + normKey || act === normKey + '_list' || act === normKey + '.list');
    var isDetail = (act === 'get_' + normKey + '_detail' || act === 'get_' + normKey + '_by_id' || act === normKey + '_detail' || act === normKey + '.get' || act === normKey + '.detail');
    var isSave = (act === 'save_' + normKey || act === 'create_' + normKey || act === 'update_' + normKey || act === normKey + '.create' || act === normKey + '.update' || act === normKey + '.save');
    var isDelete = (act === 'delete_' + normKey || act === 'remove_' + normKey || act === normKey + '.delete' || act === normKey + '.remove');

    if (isList) {
      var needRole = roles.read || 'viewer';
      if (userLevel < levelOf_(needRole, roleMap)) {
        return { success: false, code: 'FORBIDDEN', error: 'Akses baca "' + canonical + '" butuh hak akses "' + needRole + '".' };
      }
      // P1-B5 (v2.2): teruskan masterSsId eksplisit
      return executeResourceList_(ssId, canonical, data, headersMap, pkField, searchFields, resCfg.defaultSort, localConfig.masterSsId);
    }

    if (isDetail) {
      var needRoleD = roles.read || 'viewer';
      if (userLevel < levelOf_(needRoleD, roleMap)) {
        return { success: false, code: 'FORBIDDEN', error: 'Akses baca "' + canonical + '" butuh hak akses "' + needRoleD + '".' };
      }
      var targetId = data.id || (data.record && data.record[pkField]) || '';
      if (!targetId) return { success: false, code: 'BAD_REQUEST', error: 'ID ' + canonical + ' wajib diisi.' };
      // P1-B5 (v2.2): teruskan masterSsId eksplisit
      var rows = getSheetDataCached(ssId, canonical, headersMap, 180, { masterSsId: localConfig.masterSsId }).filter(function(r) { return !r.deleted_at; });
      var found = null;
      for (var j = 0; j < rows.length; j++) {
        if (String(getRecordPrimaryId_(rows[j], pkField)) === String(targetId)) { found = rows[j]; break; }
      }
      if (!found) return { success: false, code: 'NOT_FOUND', error: 'Data ' + canonical + ' tidak ditemukan.' };
      return { success: true, data: found };
    }

    if (isSave) {
      var record = extractRecord(data);
      var isUpdate = Boolean(record[pkField] && String(record[pkField]).trim() !== '');
      var needRoleS = isUpdate ? (roles.update || roles.create || 'user') : (roles.create || 'user');
      if (userLevel < levelOf_(needRoleS, roleMap)) {
        return { success: false, code: 'FORBIDDEN', error: 'Akses simpan "' + canonical + '" butuh hak akses "' + needRoleS + '".' };
      }

      // Row-level owner guard
      if (ownerField && !isAdmin) {
        if (isUpdate) {
          var rowsS = getSheetDataCached(ssId, canonical, headersMap, 180, { masterSsId: localConfig.masterSsId }).filter(function(r) { return !r.deleted_at; });
          var oldRec = null;
          for (var k = 0; k < rowsS.length; k++) {
            if (String(getRecordPrimaryId_(rowsS[k], pkField)) === String(record[pkField])) { oldRec = rowsS[k]; break; }
          }
          if (oldRec && String(oldRec[ownerField] || '').trim() !== userPegawaiId) {
            return { success: false, code: 'FORBIDDEN', error: 'Anda hanya boleh mengubah data milik sendiri.' };
          }
        } else {
          if (!record[ownerField]) record[ownerField] = userPegawaiId;
        }
      }

      var preHook = (hooks && typeof hooks.preSave === 'function') ? hooks.preSave : localConfig.preSaveHook;
      var saveResult = apiSave(ssId, canonical, record, currentUser, headersMap, localConfig.isRefSheetFunc, preHook, pkField);

      if (saveResult && saveResult.success && hooks && typeof hooks.postSave === 'function') {
        try { hooks.postSave(saveResult.data, currentUser); } catch (e) { logWarn('CoreResource', 'postSave hook: ' + e.message); }
      }
      return saveResult;
    }

    if (isDelete) {
      var needRoleDel = roles.delete || 'admin';
      if (userLevel < levelOf_(needRoleDel, roleMap)) {
        return { success: false, code: 'FORBIDDEN', error: 'Akses hapus "' + canonical + '" butuh hak akses "' + needRoleDel + '".' };
      }
      var delId = data.id || (data.record && data.record[pkField]) || '';
      if (!delId) return { success: false, code: 'BAD_REQUEST', error: 'ID ' + canonical + ' wajib diisi.' };

      if (ownerField && !isAdmin) {
        var rowsD = getSheetDataCached(ssId, canonical, headersMap, 180, { masterSsId: localConfig.masterSsId }).filter(function(r) { return !r.deleted_at; });
        var targetRec = null;
        for (var m = 0; m < rowsD.length; m++) {
          if (String(getRecordPrimaryId_(rowsD[m], pkField)) === String(delId)) { targetRec = rowsD[m]; break; }
        }
        if (targetRec && String(targetRec[ownerField] || '').trim() !== userPegawaiId) {
          return { success: false, code: 'FORBIDDEN', error: 'Anda hanya boleh menghapus data milik sendiri.' };
        }
      }

      if (hooks && typeof hooks.beforeDelete === 'function') {
        var beforeResult = hooks.beforeDelete(delId, currentUser);
        if (beforeResult && beforeResult.error) return { success: false, code: 'BAD_REQUEST', error: beforeResult.error };
      }

      return apiDelete(ssId, canonical, delId, currentUser, headersMap, localConfig.isRefSheetFunc, pkField);
    }
  }

  return null;
}

// P1-B5 (v2.2): parameter masterSsId ditambahkan (opsional, backward-compat).
function executeResourceList_(ssId, canonical, query, headersMap, pkField, customSearchFields, defaultSort, masterSsId) {
  try {
    query = query || {};
    var rows = getSheetDataCached(ssId, canonical, headersMap, 180, { masterSsId: masterSsId }).filter(function(r) { return !r.deleted_at; });
    var headers = (headersMap && headersMap[canonical]) ? headersMap[canonical] : (rows.length > 0 ? Object.keys(rows[0]) : []);

    // Filters
    var rawFilters = query.filters || query;
    if (typeof rawFilters === 'string') { try { rawFilters = JSON.parse(rawFilters); } catch (e) { rawFilters = {}; } }
    if (rawFilters && typeof rawFilters === 'object') {
      var exclude = ['action', 'token', 'search', 'page', 'limit', 'sortBy', 'sortDir', 'sortOrder', 'filters'];
      Object.keys(rawFilters).forEach(function(k) {
        if (exclude.indexOf(k) === -1) {
          var val = rawFilters[k];
          if (val !== '' && val !== null && val !== undefined) {
            rows = rows.filter(function(r) { return String(r[k] || '').toLowerCase().trim() === String(val).toLowerCase().trim(); });
          }
        }
      });
    }

    // Search
    var q = String(query.search || '').toLowerCase().trim();
    if (q) {
      var fields = (customSearchFields && customSearchFields.length > 0) ? customSearchFields : headers;
      rows = rows.filter(function(r) {
        return fields.some(function(f) { return String(r[f] || '').toLowerCase().indexOf(q) !== -1; });
      });
    }

    // Sort
    var sortKey = query.sortBy || (defaultSort && defaultSort.field) || '';
    var sortOrder = query.sortDir || query.sortOrder || (defaultSort && defaultSort.order) || 'asc';
    if (sortKey) {
      var dir = String(sortOrder).toLowerCase() === 'desc' ? -1 : 1;
      rows.sort(function(a, b) {
        var av = String(a[sortKey] || ''), bv = String(b[sortKey] || '');
        return (av < bv ? -1 : (av > bv ? 1 : 0)) * dir;
      });
    }

    // Pagination
    var page = parseInt(query.page, 10); if (isNaN(page) || page < 1) page = 1;
    var limit = parseInt(query.limit, 10); if (isNaN(limit) || limit < 1) limit = 50; if (limit > 500) limit = 500;
    var total = rows.length;
    var start = (page - 1) * limit;

    return {
      success: true,
      data: rows.slice(start, start + limit),
      meta: { total: total, page: page, limit: limit, total_pages: Math.max(1, Math.ceil(total / limit)) }
    };
  } catch (err) {
    logError('CoreResource.list', err.message);
    return { success: false, code: 'BAD_REQUEST', error: err.message };
  }
}

// ============================================================
// §8 DISPATCHER
// ============================================================

// v2.2.3 FIX (P1-C1 tuntas): fail-closed — undefined → 0 (selaras checkAuth &
// requireRole_). Fallback lama `|| 1` menaikkan viewer (0, falsy) & role tak
// dikenal menjadi level 1 sehingga.viewer LOLOS gerbang save/delete 'user'
// di Declarative Resource Router & entityPermissions.
function levelOf_(role, map) {
  var lv = map && map[String(role).toLowerCase()];
  return lv === undefined ? 0 : lv;
}

function entityGate_(entity, headersMap) {
  if (!entity || entity === 'UNDEFINED') return 'Entitas tidak valid.';
  if (headersMap && headersMap[entity]) return null;
  if (DEFAULT_SYSTEM_HEADERS[entity] || MASTER_SHEET_HEADERS[entity]) return null;
  return 'Entitas "' + entity + '" tidak dikenal.';
}

function dispatchAction(payload, localConfig) {
  payload = payload || {};
  var action = String(payload.action || '').toLowerCase();
  var data = payload.data || {};
  var token = payload.token || data.token || '';
  localConfig = localConfig || {};
  var ssId = localConfig.spreadsheetId;
  var headersMap = localConfig.headersMap;
  var localHandlers = localConfig.localHandlers || {};
  var prefix = sessionPrefixFor_(localConfig);
  var roleMap = localConfig.roleLevels || MASTER_ROLE_LEVELS;
  logInfo('CoreRouter', 'Handling action: ' + action);
  try {
    // 1. Publik: tukar tiket & logout (tanpa session)
    if (action === 'exchange_platform_ticket' || action === 'exchange_sso_ticket') {
      var ticketEx = (typeof data === 'string') ? data : (data.ticket || payload.ticket || '');
      return exchangePlatformTicket(ticketEx, localConfig);
    }
    if (action === 'logout') return logoutUser(token, prefix);
    // Handler SSO pre-auth (signature: fn(data, payload) — TANPA user).
    if (localHandlers[action] && typeof localHandlers[action] === 'function' && (action === 'validate_sso_ticket' || action === 'generate_sso_ticket')) {
      return localHandlers[action](data, payload);
    }
    // 2. Level minimal: actionLevels kustom menang atas default.
    //    P1-B3 (v2.1): 'save_my_profile' DIPINDAH dari 'admin' ke 'viewer'.
    var minLevel = (localConfig.actionLevels && localConfig.actionLevels[action]) ||
      ((['save', 'delete', 'save_config_item'].indexOf(action) !== -1) ? 'admin' : 'viewer');
    var auth = checkAuth(token, minLevel, prefix, roleMap);
    if (!auth.success) return auth;
    var currentUser = auth.user;

    // 3. Handler lokal dinas kustom (signature: fn(data, currentUser) — post-auth).
    if (localHandlers[action] && typeof localHandlers[action] === 'function') {
      return localHandlers[action](data, currentUser);
    }

    // 4. Declarative Resource Router (Auto-CRUD with Row-Level Security, Search & Cache)
    var resourceResult = handleDeclarativeResourceAction_(action, data, currentUser, localConfig);
    if (resourceResult !== null) return resourceResult;

    // 5. Aksi universal.
    var masterDb = localConfig.masterSsId || ssId;
    switch (action) {
      case 'get_profile':
        var profile = getProfile(ssId, currentUser.email, headersMap, localConfig.masterSsId);
        return { success: true, data: profile || currentUser };
      case 'save_my_profile':
        return saveMyProfile(ssId, data, currentUser, headersMap, localConfig.masterSsId);
      case 'get_config':
        return { success: true, data: getSheetDataCached(ssId, 'KONFIGURASI', headersMap, 300) };
      case 'save_config_item':
        return saveConfigItem(ssId, data, currentUser, headersMap);
      case 'get_pegawai_list':
        return { success: true, data: getSheetDataCached(masterDb, 'PEGAWAI', MASTER_SHEET_HEADERS, 300, { masterSsId: localConfig.masterSsId }) };
      case 'get_unit_list':
        return { success: true, data: getSheetDataCached(masterDb, 'UNIT_KERJA', MASTER_SHEET_HEADERS, 300, { masterSsId: localConfig.masterSsId }) };
      case 'get_jabatan_list':
        return { success: true, data: getSheetDataCached(masterDb, 'JABATAN', MASTER_SHEET_HEADERS, 300, { masterSsId: localConfig.masterSsId }) };
      case 'get': {
        var entityGet = String(data.entity || data.sheetName || data.table || '').toUpperCase();
        var gateErr = entityGate_(entityGet, headersMap);
        if (gateErr) return { success: false, code: 'NOT_FOUND', error: gateErr };
        var needGet = 'viewer';
        if (localConfig.entityPermissions && localConfig.entityPermissions[entityGet] && localConfig.entityPermissions[entityGet].read) needGet = localConfig.entityPermissions[entityGet].read;
        if (levelOf_(currentUser.role, roleMap) < levelOf_(needGet, roleMap)) return { success: false, code: 'FORBIDDEN', error: 'Akses baca "' + entityGet + '" butuh "' + needGet + '".' };
        return apiGet(ssId, entityGet, data.id || null, data, headersMap, pkFor_(localConfig, entityGet), localConfig.masterSsId);
      }
      case 'save': {
        var entitySave = String(data.entity || data.sheetName || data.table || '').toUpperCase();
        var gateErrS = entityGate_(entitySave, headersMap);
        if (gateErrS) return { success: false, code: 'NOT_FOUND', error: gateErrS };
        var needWrite = 'admin';
        if (localConfig.entityPermissions && localConfig.entityPermissions[entitySave] && localConfig.entityPermissions[entitySave].write) needWrite = localConfig.entityPermissions[entitySave].write;
        if (levelOf_(currentUser.role, roleMap) < levelOf_(needWrite, roleMap)) return { success: false, code: 'FORBIDDEN', error: 'Akses tulis "' + entitySave + '" butuh "' + needWrite + '".' };
        return apiSave(ssId, entitySave, extractRecord(data), currentUser, headersMap, localConfig.isRefSheetFunc, localConfig.preSaveHook, pkFor_(localConfig, entitySave));
      }
      case 'delete': {
        var entityDel = String(data.entity || data.sheetName || data.table || '').toUpperCase();
        var gateErrD = entityGate_(entityDel, headersMap);
        if (gateErrD) return { success: false, code: 'NOT_FOUND', error: gateErrD };
        var needDel = 'admin';
        if (localConfig.entityPermissions && localConfig.entityPermissions[entityDel] && localConfig.entityPermissions[entityDel].write) needDel = localConfig.entityPermissions[entityDel].write;
        if (levelOf_(currentUser.role, roleMap) < levelOf_(needDel, roleMap)) return { success: false, code: 'FORBIDDEN', error: 'Akses hapus "' + entityDel + '" butuh "' + needDel + '".' };
        return apiDelete(ssId, entityDel, data.id, currentUser, headersMap, localConfig.isRefSheetFunc, pkFor_(localConfig, entityDel));
      }
      default:
        return { success: false, code: 'NOT_FOUND', error: 'Aksi "' + action + '" tidak dikenali.' };
    }
  } catch (err) { logError('CoreRouter', 'CRITICAL: ' + err.message); return { success: false, code: 'BAD_REQUEST', error: err.message }; }
}

function pkFor_(localConfig, entity) {
  return (localConfig && localConfig.pkFields && localConfig.pkFields[entity]) || undefined;
}

// ============================================================
// §9 PUBLIC API (v2.2) — wrapper tanpa underscore
// ============================================================
// Pintu API untuk app konsumer. Panggil via CoreLib.xxx.
// ============================================================

/** Validasi role user terhadap minRole. Throw bila kurang. */
function requireRole(user, minRole, customLevels) { return requireRole_(user, minRole, customLevels); }

/** Cek izin user terhadap action menurut actionRoleMap. */
function checkRole(user, action, actionRoleMap) { return checkRole_(user, action, actionRoleMap); }

/** Tentukan role dari email via whitelist ADMIN_EMAILS/VERIFIKATOR_EMAILS. */
function getRoleForEmail(email, store) { return getRoleForEmail_(email, store); }

/** Cek apakah key config boleh diubah dari UI. */
function isAllowedConfigKey(key, extraKeys) { return isAllowedConfigKey_(key, extraKeys); }
