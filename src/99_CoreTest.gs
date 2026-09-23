// ============================================================
// CORE LIBRARY GLOBAL v2.4.0 - 99_CoreTest.gs
// Changelog v2.4.0 (2026-09-22) — A+B DRAFT (C4/C5/C6/C7/C8):
// - TEST BARU (5): testAssertOwnershipV240, testValidateTransitionV240,
//   testThemeConfigV240, testPeriodeHariKerjaV240, testFindUpsertUniqueV240
//   — regresi C4/C5/C6/C7/C8. Target testAll: PASS 47 / FAIL 0 / SKIP 1.
// Changelog v2.3.0 (2026-09-19):
// - TEST BARU (4): testTodayIsoLocalV230, testDateKey10V230,
//   testPaginateV230, testMatchSearchV230 — regresi util publik
//   baru C1/C2/C3. Target testAll: PASS 42 / FAIL 0 / SKIP 1.
// Changelog v2.2.3 (2026-09-16):
// - Sinkron rilis v2.2.3: testRoleGateV222 (sudah ada sejak v2.2.2) KINI
//   LULUS — fix levelOf_ yang diuji ternyata baru benar-benar diterapkan
//   di 02_CoreGateway v2.2.3. Tanpa perubahan test di berkas ini.
// Changelog v2.2.2 (2026-09-15):
// - TEST BARU: regresi gating role (levelOf_/requireRole_ dengan skala
//   viewer=0) — pastikan fallback `|| 1` lama tidak kembali.
// Changelog v2.2.1 (2026-09-13):
// - P1-T6 FIX: testGenUniqueCodeV22 — rewrite total agar DETERMINISTIK.
//              Sebelumnya berasumsi sheet ZZ_TEST_CRUD kosong; gagal
//              bila ada sisa data dari test lain. Sekarang:
//              wipe sheet dulu → uji incremental 001→002→003
//              + uji isolasi prefix + uji ID tak berhubungan.
// Changelog v2.2.0 (2026-09-12):
// - P1-T2 FIX: testSheetHeaders — sheet sistem di-skip.
// - P1-T5 FIX: testAll() baca TEST_SPREADSHEET_ID_B dari props.
// - BARU: 9 test v2.2 untuk fungsi publik baru.
// Changelog v2.1 (2026-09-12):
// - P1-T1 FIX: testCacheIsolation assertion nyata.
// - P1-T2 FIX: testRoleMapping sesuai MASTER_ROLE_LEVELS v2.1.
// - P1-T3 BARU: 6 test baru (testRoleLevelsV21, testDateUtilsV21, ...).
// - P1-T4 FIX: testDeclarativeResourceRouter pakai `nama`.
// Changelog v2:
// - T1 FIX: assert_ + runCoreTests(ctx) dengan rekap {passed, failed, skipped}.
// - T4 FIX: testSheetHeaders CHECK-ONLY.
// - T3 FIX: testGenericCrud verifikasi jumlah baris + hard-cleanup.
// - T5 FIX: matriks read-only 3 sheet x 5 jalur.
// ctx = { ssId, ssIdB?, masterSsId?, headersMap, isRefFunc?, platformApiUrl?, appCode? }
// ============================================================

function assert_(cond, msg) { if (!cond) throw new Error('ASSERTION FAILED: ' + (msg || '')); }
function skip_(msg) { throw { __skip: true, message: msg }; }
function need_(cond, msg) { if (!cond) skip_(msg); }

// Session khusus-uji.
function mintTestSession_(config, role, email) {
  var prefix = sessionPrefixFor_(config || {});
  var token = 'TEST_' + Utilities.getUuid();
  CacheService.getScriptCache().put(
    prefix + token,
    JSON.stringify({ user_id: 'TEST-USER', email: email || 'tester@example.com', role: role || 'viewer', pegawai_id: '', nip: '', display_name: 'Tester' }),
    600
  );
  return { prefix: prefix, token: token };
}
function burnTestSession_(prefix, token) { try { CacheService.getScriptCache().remove(prefix + token); } catch (e) {} }

function runCoreTests(ctx) {
  ctx = ctx || {};
  var tests = [
    // File 1 (Foundation)
    testDatabaseConnection, testSheetHeaders, testSystemContract, testReadOnlyProtection,
    testRowIndexWithGaps, testHeaderOrderDrift, testCacheIsolation, testCustomPk,
    testDateRoundTrip, testNullClears, testStrictUpsert, testHardDeleteConfig,
    // File 2 (Gateway)
    testTicketBinding, testSessionPrefix, testTestModeRemoved, testTtlCap,
    testRoleMapping, testResolvePegawai, testAuditStrip, testDispatcherAuthz,
    testDeclarativeResourceRouter, testSsoFlow, testGenericCrud,
    // v2.1 baru
    testRoleLevelsV21, testDateUtilsV21, testGetLevelJabatanV21,
    testGetUnitBawahanV21, testActionNotFoundV21, testSessionExpiredV21,
    // v2.2 baru
    testNormUtilV22, testParseDateV22, testWhitelistV22,
    testValidateFieldsV22, testGenUniqueCodeV22,
    testRequireRoleV22, testCheckRoleV22,
    testGetRoleForEmailV22, testIsAllowedConfigKeyV22,
    // v2.2.2 baru
    testRoleGateV222,
    // v2.3.0 baru (C1/C2/C3)
    testTodayIsoLocalV230, testDateKey10V230,
    testPaginateV230, testMatchSearchV230,
    // v2.4.0 baru (C4/C5/C6/C7/C8) — A+B
    testAssertOwnershipV240, testValidateTransitionV240, testThemeConfigV240,
    testPeriodeHariKerjaV240, testFindUpsertUniqueV240
  ];
  var passed = 0, failed = 0, skipped = 0, details = [];
  tests.forEach(function(fn) {
    try { fn(ctx); passed++; details.push({ test: fn.name, status: 'PASS' }); }
    catch (e) {
      if (e && e.__skip) { skipped++; details.push({ test: fn.name, status: 'SKIP', detail: e.message }); }
      else { failed++; details.push({ test: fn.name, status: 'FAIL', detail: String((e && e.message) || e) }); }
    }
  });
  logInfo('CoreTest', 'SELESAI. PASS: ' + passed + ', FAIL: ' + failed + ', SKIP: ' + skipped);
  return { passed: passed, failed: failed, skipped: skipped, results: details };
}

// ---- koneksi & skema (check-only) ----
function testDatabaseConnection(ctx) {
  need_(ctx.ssId, 'ctx.ssId kosong.');
  var ss = getDb(ctx.ssId);
  assert_(ss.getName(), 'Nama spreadsheet terbaca.');
}

// P1-T2 (v2.2): sheet sistem & ref di-skip; hanya sheet internal yang di-assert.
function testSheetHeaders(ctx) {
  need_(ctx.headersMap, 'ctx.headersMap kosong.');
  var ss = getDb(ctx.ssId);
  Object.keys(ctx.headersMap).forEach(function(key) {
    var canonical = resolveCanonical_(key, ctx.headersMap);
    var isRef = ctx.isRefFunc ? ctx.isRefFunc(canonical) : isReferenceSheet(canonical);
    var isSystem = ['AUDIT_LOGS', 'KONFIGURASI', 'MAIN_DATA'].indexOf(canonical) !== -1;

    if (isRef) {
      var shRef = ss.getSheetByName(canonical);
      if (!shRef) logWarn('CoreTest', 'Ref ' + canonical + ' belum ada lokal (baca via master).');
      return;
    }
    if (isSystem) {
      var shSys = ss.getSheetByName(canonical);
      if (!shSys) logInfo('CoreTest', 'Sheet sistem ' + canonical + ' belum ada (dibuat otomatis saat write pertama).');
      return;
    }
    var sh = ss.getSheetByName(canonical);
    assert_(sh, 'Sheet internal ' + canonical + ' ada. Jalankan initDatabase dulu.');
    var have = sheetHeaders_(sh);
    ctx.headersMap[key].forEach(function(h) {
      assert_(have.indexOf(h) !== -1, canonical + ' memuat kolom ' + h);
    });
  });
}

// Kontrak tabel sistem (H5/H3): header default harus tersedia.
function testSystemContract(ctx) {
  ['AUDIT_LOGS', 'KONFIGURASI', 'MAIN_DATA'].forEach(function(s) {
    var r = resolveHeaders_(s, ctx.headersMap || {}, null);
    assert_(r.headers.length > 0, 'Header ' + s + ' ter-resolve.');
  });
  assert_(resolveHeaders_('AUDIT_LOGS', {}, null).headers.join(',') === DEFAULT_SYSTEM_HEADERS.AUDIT_LOGS.join(','), 'Default AUDIT_LOGS utuh.');
}

// Matriks read-only: 3 sheet x write/soft/hard/apiSave/apiDelete.
function testReadOnlyProtection(ctx) {
  need_(ctx.ssId, 'ctx.ssId kosong.');
  var actor = systemActor(), map = ctx.headersMap || {};
  ['PEGAWAI', 'UNIT_KERJA', 'JABATAN'].forEach(function(sheet) {
    var blocked = 0;
    try { writeRecordNoLock(ctx.ssId, sheet, { id: 'X' }, false, actor, map); } catch (e) { blocked++; }
    try { softDeleteRecordNoLock(ctx.ssId, sheet, 'X', actor, map); } catch (e) { blocked++; }
    try { hardDeleteRecordNoLock(ctx.ssId, sheet, 'X', actor); } catch (e) { blocked++; }
    if (!apiSave(ctx.ssId, sheet, { id: 'X' }, actor, map).success) blocked++;
    if (!apiDelete(ctx.ssId, sheet, 'X', actor, map).success) blocked++;
    assert_(blocked === 5, sheet + ' ditolak di 5/5 jalur (' + blocked + '/5).');
  });
}

// ---- regresi File 1 ----
function testSheetForCrud_(ctx) {
  need_(ctx.ssId, 'ctx.ssId kosong.');
  need_(ctx.headersMap && ctx.headersMap.ZZ_TEST_CRUD, 'ctx.headersMap.ZZ_TEST_CRUD belum didefinisikan.');
  return ensureSheet(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap, {});
}
function wipeSheet_(sh) { if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent(); }

function testRowIndexWithGaps(ctx) {
  var sh = testSheetForCrud_(ctx);
  wipeSheet_(sh);
  var a = writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'GAP-1', nama: 'satu' }, false, systemActor(), ctx.headersMap);
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'GAP-2', nama: 'dua' }, false, systemActor(), ctx.headersMap);
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'GAP-3', nama: 'tiga' }, false, systemActor(), ctx.headersMap);
  sh.getRange(3, 1, 1, sh.getLastColumn()).clearContent();
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'GAP-3', nama: 'TIGA-BARU' }, true, systemActor(), ctx.headersMap);
  var rows = readRecordsNoLock(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap);
  var r1 = null, r3 = null;
  rows.forEach(function(r) { if (r.id === 'GAP-1') r1 = r; if (r.id === 'GAP-3') r3 = r; });
  assert_(r3 && r3.nama === 'TIGA-BARU', 'GAP-3 terupdate tepat.');
  assert_(r1 && r1.nama === 'satu', 'GAP-1 tidak tertimpa.');
  assert_(a && a.id === 'GAP-1', 'Insert mengembalikan record.');
}

function testHeaderOrderDrift(ctx) {
  var sh = testSheetForCrud_(ctx);
  wipeSheet_(sh);
  var map2 = { ZZ_TEST_CRUD: ['id', 'catatan_baru', 'nama'] };
  ensureSheet(ctx.ssId, 'ZZ_TEST_CRUD', map2, {});
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'DRIFT-1', nama: 'NamaAsli', catatan_baru: 'CatAsli' }, false, systemActor(), map2);
  var back = readRecordsNoLock(ctx.ssId, 'ZZ_TEST_CRUD', map2);
  var r = null;
  back.forEach(function(x) { if (x.id === 'DRIFT-1') r = x; });
  assert_(r && r.nama === 'NamaAsli' && r.catatan_baru === 'CatAsli', 'Nilai mendarat di kolom by-name.');
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'DRIFT-1', nama: 'NamaUbah' }, true, systemActor(), map2);
  var back2 = readRecordsNoLock(ctx.ssId, 'ZZ_TEST_CRUD', map2);
  var r2 = null;
  back2.forEach(function(x) { if (x.id === 'DRIFT-1') r2 = x; });
  assert_(r2 && r2.nama === 'NamaUbah' && r2.catatan_baru === 'CatAsli', 'Update tidak mengacak kolom lain.');
}

function testCacheIsolation(ctx) {
  need_(ctx.ssId, 'ctx.ssId kosong.');
  need_(ctx.ssIdB, 'ctx.ssIdB kosong (set TEST_SPREADSHEET_ID_B di Script Properties).');
  need_(ctx.headersMap && ctx.headersMap.ZZ_TEST_CRUD, 'headersMap.ZZ_TEST_CRUD wajib ada.');

  var shA = ensureSheet(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap, {});
  var shB = ensureSheet(ctx.ssIdB, 'ZZ_TEST_CRUD', ctx.headersMap, {});
  wipeSheet_(shA);
  wipeSheet_(shB);

  var idA = 'CACHE-A-' + new Date().getTime();
  var idB = 'CACHE-B-' + new Date().getTime();
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: idA, nama: 'DB-A' }, false, systemActor(), ctx.headersMap);
  writeRecordNoLock(ctx.ssIdB, 'ZZ_TEST_CRUD', { id: idB, nama: 'DB-B' }, false, systemActor(), ctx.headersMap);

  invalidateSheetCache('ZZ_TEST_CRUD', ctx.ssId);
  invalidateSheetCache('ZZ_TEST_CRUD', ctx.ssIdB);
  var dataA = getSheetDataCached(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap, 300);
  var dataB = getSheetDataCached(ctx.ssIdB, 'ZZ_TEST_CRUD', ctx.headersMap, 300);

  var aHasA = dataA.some(function(r) { return r.id === idA; });
  var aHasB = dataA.some(function(r) { return r.id === idB; });
  var bHasA = dataB.some(function(r) { return r.id === idA; });
  var bHasB = dataB.some(function(r) { return r.id === idB; });

  assert_(aHasA, 'DB A berisi record A.');
  assert_(!aHasB, 'DB A TIDAK berisi record B (cache/read terisolasi).');
  assert_(bHasB, 'DB B berisi record B.');
  assert_(!bHasA, 'DB B TIDAK berisi record A (cache/read terisolasi).');

  hardDeleteRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', idA, systemActor());
  hardDeleteRecordNoLock(ctx.ssIdB, 'ZZ_TEST_CRUD', idB, systemActor());
}

function testCustomPk(ctx) {
  var sh = testSheetForCrud_(ctx);
  wipeSheet_(sh);
  var before = readRecordsNoLock(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap).length;
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { laporan_id: 'LAP-1', nama: 'v1' }, false, systemActor(), ctx.headersMap, null, 'laporan_id');
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { laporan_id: 'LAP-1', nama: 'v2' }, true, systemActor(), ctx.headersMap, null, 'laporan_id');
  var after = readRecordsNoLock(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap);
  assert_(after.length === before + 1, 'Update PK kustom tidak menambah baris.');
  var auto = getRecordPrimaryId_({ laporan_id: 'LAP-9' });
  assert_(auto === 'LAP-9', 'Auto-deteksi *_id jalan.');
}

function testDateRoundTrip(ctx) {
  var d = new Date(2026, 8, 8, 14, 30, 0);
  var iso = formatDateForSheet(d);
  assert_(iso.indexOf('2026-09-08') === 0 && iso.indexOf('T') !== -1, 'formatDateForSheet ISO: ' + iso);
  var back = parseTanggalBackend(iso);
  assert_(back && back.getFullYear() === 2026, 'ISO terbaca balik.');
  assert_(parseTanggalBackend('08/09/2026 14:30').getDate() === 8, 'Legacy dd/MM tetap terbaca.');
}

function testNullClears(ctx) {
  var sh = testSheetForCrud_(ctx);
  wipeSheet_(sh);
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'CLR-1', nama: 'isi', no_hp: '0812' }, false, systemActor(), ctx.headersMap);
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'CLR-1', no_hp: null }, true, systemActor(), ctx.headersMap);
  var rows = readRecordsNoLock(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap);
  var r = null;
  rows.forEach(function(x) { if (x.id === 'CLR-1') r = x; });
  assert_(r && (r.no_hp === '' || r.no_hp === null), 'null mengosongkan field.');
  assert_(r && r.nama === 'isi', 'undefined mempertahankan field lain.');
}

function testStrictUpsert(ctx) {
  testSheetForCrud_(ctx);
  var threwU = false, threwI = false;
  try { writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'YATIM-' + new Date().getTime() }, true, systemActor(), ctx.headersMap); } catch (e) { threwU = true; }
  assert_(threwU, 'Update ID tak dikenal ditolak.');
  var dupId = 'DUP-' + new Date().getTime();
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: dupId }, false, systemActor(), ctx.headersMap);
  try { writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: dupId }, false, systemActor(), ctx.headersMap); } catch (e) { threwI = true; }
  assert_(threwI, 'Insert PK duplikat ditolak.');
}

function testHardDeleteConfig(ctx) {
  need_(ctx.ssId, 'ctx.ssId kosong.');
  var actor = systemActor(), key = 'test_key_temp_' + new Date().getTime();
  var saveRes = saveConfigItem(ctx.ssId, { key: key, value: 'temp_val', keterangan: 'Uji hapus' }, actor, ctx.headersMap);
  assert_(saveRes.success && saveRes.data && saveRes.data.id, 'Dummy config tersimpan.');
  var delRes = apiDelete(ctx.ssId, 'KONFIGURASI', saveRes.data.id, actor, ctx.headersMap);
  assert_(delRes.success, 'Hard delete KONFIGURASI: ' + (delRes.error || 'ok'));
  var still = getConfigList(ctx.ssId, ctx.headersMap).some(function(c) { return String(c.key) === key; });
  assert_(!still, 'Item terhapus permanen.');
}

// ---- regresi File 2 ----
function testTicketBinding(ctx) {
  assertTicketBinding_('SIMPEG', 'SIMPEG');
  assertTicketBinding_('', 'SIMPEG');
  assertTicketBinding_('SIMPEG', '');
  var threw = false;
  try { assertTicketBinding_('SIMPEG', 'SIUJI'); } catch (e) { threw = true; }
  assert_(threw, 'AppCode beda ditolak.');
}

function testSessionPrefix(ctx) {
  var a = sessionPrefixFor_({ appCode: 'APP_A' }), b = sessionPrefixFor_({ appCode: 'APP_B' });
  assert_(a !== b, 'Prefix per appCode berbeda.');
  assert_(sessionPrefixFor_({ appCode: 'X', sessionPrefix: 'KUSTOM_' }) === 'KUSTOM_', 'Prefix kustom dihormati.');
  var s = mintTestSession_({ appCode: 'APP_A' }, 'admin', 'a@example.com');
  var okA = checkAuth(s.token, 'viewer', s.prefix);
  var okB = checkAuth(s.token, 'viewer', sessionPrefixFor_({ appCode: 'APP_B' }));
  burnTestSession_(s.prefix, s.token);
  assert_(okA.success, 'Token valid di prefix sendiri.');
  assert_(!okB.success, 'Token DITOLAK di prefix app lain.');
}

function testTestModeRemoved(ctx) {
  var r = exchangePlatformTicket('tiket-apa-pun', { testMode: true, appCode: 'X' });
  assert_(!r.success, 'testMode tidak menghasilkan session.');
}

function testTtlCap(ctx) {
  assert_(capTtl_(28800) === 21600, '28800 di-cap 21600.');
  assert_(capTtl_(60) === 60 && capTtl_(10) === 60, 'Batas bawah 60.');
  CacheService.getScriptCache().put('__ttl_probe__', 'x', capTtl_(28800));
  assert_(CacheService.getScriptCache().get('__ttl_probe__') === 'x', 'Nilai cap lolos cache.put.');
  CacheService.getScriptCache().remove('__ttl_probe__');
}

function testRoleMapping(ctx) {
  assert_(getHighestRole(['kasat']) === 'admin', 'kasat->admin.');
  assert_(getHighestRole(['kabid']) === 'admin', 'kabid->admin.');
  assert_(getHighestRole(['kepala_dinas']) === 'admin', 'kepala_dinas->admin.');
  assert_(getHighestRole(['sekretaris']) === 'admin', 'sekretaris->admin.');
  assert_(getHighestRole(['admin']) === 'admin', 'admin->admin.');
  assert_(getHighestRole(['administrator']) === 'admin', 'administrator->admin.');
  assert_(getHighestRole(['kasi']) === 'verifikator', 'kasi->verifikator.');
  assert_(getHighestRole(['kasubbag']) === 'verifikator', 'kasubbag->verifikator.');
  assert_(getHighestRole(['verifikator']) === 'verifikator', 'verifikator->verifikator.');
  assert_(getHighestRole(['operator']) === 'user', 'operator->user.');
  assert_(getHighestRole(['auditor']) === 'user', 'auditor->user.');
  assert_(getHighestRole(['bendahara']) === 'user', 'bendahara->user.');
  assert_(getHighestRole(['pegawai']) === 'user', 'pegawai->user.');
  assert_(getHighestRole(['user']) === 'user', 'user->user.');
  assert_(getHighestRole(['viewer']) === 'viewer', 'viewer->viewer.');
  assert_(getHighestRole(['tamu']) === 'viewer', 'tamu->viewer.');
  assert_(getHighestRole(['superadmin']) === 'super', 'superadmin->super.');
  assert_(getHighestRole(['super']) === 'super', 'super->super.');
  assert_(getHighestRole(['kode_tak_dikenal_xyz']) === 'viewer', 'Tak dikenal->viewer.');
  assert_(getHighestRole([]) === 'viewer', 'Kosong->viewer.');
  assert_(getHighestRole(null) === 'viewer', 'Null->viewer.');
  assert_(getHighestRole(['viewer', 'kabid']) === 'admin', 'viewer+kabid->admin.');
  assert_(getHighestRole(['user', 'kasi']) === 'verifikator', 'user+kasi->verifikator.');
  assert_(getHighestRole(['pegawai', 'superadmin']) === 'super', 'pegawai+superadmin->super.');
}

function testResolvePegawai(ctx) {
  var rows = [{ pegawai_id: 'PEG-1', nip: '198001012010011001', nama: 'Budi', email: 'Budi@Example.com' }];
  var hit = resolvePegawaiFromRows_(rows, 'budi@example.com');
  assert_(hit.pegawai_id === 'PEG-1', 'ID pegawai cocok case-insensitive.');
  assert_(hit.nip === '198001012010011001', 'NIP cocok.');
  assert_(hit.nama === 'Budi', 'Nama cocok.');
  var miss = resolvePegawaiFromRows_(rows, 'takada@example.com');
  assert_(miss.pegawai_id === '' && miss.nip === '', 'Tak cocok = kosong (tanpa fabrikasi).');
}

function testAuditStrip(ctx) {
  need_(ctx.ssId && ctx.headersMap && ctx.headersMap.ZZ_TEST_CRUD, 'Butuh ssId + ZZ_TEST_CRUD.');
  var res = apiSave(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'AUDIT-1', nama: 'x', created_by: 'hacker', updated_by: 'hacker', deleted_at: 'x' }, { id: 'UJI', email: 'uji@example.com' }, ctx.headersMap);
  assert_(res.success, 'Save jalan.');
  assert_(res.data.created_by !== 'hacker' && res.data.updated_by !== 'hacker', 'Field audit otoritas server.');
  assert_(!res.data.deleted_at, 'deleted_at tidak bisa diset via save.');
}

function testDispatcherAuthz(ctx) {
  need_(ctx.ssId && ctx.headersMap, 'Butuh ssId + headersMap.');
  var cfg = { appCode: ctx.appCode || 'TESTAPP', spreadsheetId: ctx.ssId, headersMap: ctx.headersMap, pkFields: { ZZ_TEST_CRUD: 'id' } };
  var viewer = mintTestSession_(cfg, 'viewer', 'v@example.com');
  var admin = mintTestSession_(cfg, 'admin', 'a@example.com');
  try {
    var denied = dispatchAction({ action: 'save', token: viewer.token, data: { entity: 'ZZ_TEST_CRUD', record: { id: 'AUTHZ-1' } } }, cfg);
    assert_(!denied.success, 'Viewer DITOLAK save.');
    var unk = dispatchAction({ action: 'get', token: admin.token, data: { entity: 'TABEL_SILUMAN_XYZ' } }, cfg);
    assert_(!unk.success, 'Entitas tak dikenal DITOLAK.');
    var ok = dispatchAction({ action: 'save', token: admin.token, data: { entity: 'ZZ_TEST_CRUD', record: { id: 'AUTHZ-2', nama: 'ok' } } }, cfg);
    assert_(ok.success, 'Admin DIIZINKAN save: ' + (ok.error || 'ok'));
    var got = dispatchAction({ action: 'get', token: viewer.token, data: { entity: 'ZZ_TEST_CRUD', id: 'AUTHZ-2' } }, cfg);
    assert_(got.success && got.data, 'Viewer DIIZINKAN baca.');
  } finally {
    burnTestSession_(viewer.prefix, viewer.token);
    burnTestSession_(admin.prefix, admin.token);
    hardDeleteRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', 'AUTHZ-2', systemActor());
  }
}

function testDeclarativeResourceRouter(ctx) {
  need_(ctx.ssId && ctx.headersMap && ctx.headersMap.ZZ_TEST_CRUD, 'Butuh ssId + ZZ_TEST_CRUD.');
  var preHookCalled = false, postHookCalled = false;
  var cfg = {
    appCode: ctx.appCode || 'TESTAPP',
    spreadsheetId: ctx.ssId,
    headersMap: ctx.headersMap,
    resources: {
      zz_test_crud: {
        sheetName: 'ZZ_TEST_CRUD',
        pk: 'id',
        ownerField: 'nama',
        searchFields: ['id', 'nama', 'no_hp'],
        roles: { read: 'viewer', create: 'user', update: 'user', delete: 'admin' },
        hooks: {
          preSave: function(canonical, record, actor) {
            preHookCalled = true;
            if (record.no_hp === 'INVALID') return { error: 'No HP tidak valid' };
            return { record: record };
          },
          postSave: function(saved, actor) {
            postHookCalled = true;
          }
        }
      }
    }
  };

  var userA = mintTestSession_(cfg, 'user', 'userA@example.com');
  var userB = mintTestSession_(cfg, 'user', 'userB@example.com');
  var admin = mintTestSession_(cfg, 'admin', 'admin@example.com');

  var id1 = 'RES-1-' + new Date().getTime();
  var uniqueName = 'UserA-UNIQ-' + new Date().getTime();

  try {
    var hookFail = dispatchAction({ action: 'save_zz_test_crud', token: userA.token, data: { id: id1, nama: 'UserA', no_hp: 'INVALID' } }, cfg);
    assert_(!hookFail.success && hookFail.error === 'No HP tidak valid', 'preSave hook memvalidasi.');

    var saveOk = dispatchAction({ action: 'save_zz_test_crud', token: userA.token, data: { id: id1, nama: uniqueName, no_hp: '08123' } }, cfg);
    assert_(saveOk.success && preHookCalled && postHookCalled, 'Auto save + hook dipanggil.');

    var listRes = dispatchAction({ action: 'get_zz_test_crud_list', token: userB.token, data: { search: uniqueName } }, cfg);
    assert_(listRes.success && listRes.data.length >= 1, 'Auto list & search berjalan.');

    var detailRes = dispatchAction({ action: 'get_zz_test_crud_detail', token: userB.token, data: { id: id1 } }, cfg);
    assert_(detailRes.success && detailRes.data && detailRes.data.id === id1, 'Auto detail by ID berjalan.');

    var tamper = dispatchAction({ action: 'save_zz_test_crud', token: userB.token, data: { id: id1, nama: 'UserB', no_hp: '08999' } }, cfg);
    assert_(!tamper.success && tamper.code === 'FORBIDDEN', 'Row-level security tolak edit orang lain.');

    var adminEdit = dispatchAction({ action: 'save_zz_test_crud', token: admin.token, data: { id: id1, nama: uniqueName, no_hp: '08111' } }, cfg);
    assert_(adminEdit.success, 'Admin boleh update data siapa saja.');

    var userDel = dispatchAction({ action: 'delete_zz_test_crud', token: userA.token, data: { id: id1 } }, cfg);
    assert_(!userDel.success && userDel.code === 'FORBIDDEN', 'Non-admin dilarang delete.');

    var adminDel = dispatchAction({ action: 'delete_zz_test_crud', token: admin.token, data: { id: id1 } }, cfg);
    assert_(adminDel.success, 'Admin berhasil menghapus declarative resource.');
  } finally {
    burnTestSession_(userA.prefix, userA.token);
    burnTestSession_(userB.prefix, userB.token);
    burnTestSession_(admin.prefix, admin.token);
    hardDeleteRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', id1, systemActor());
  }
}

function testSsoFlow(ctx) {
  need_(ctx.platformApiUrl, 'ctx.platformApiUrl kosong (uji live dilewati).');
  var threw = false;
  try { validatePlatformTicket('tiket_palsu_12345', ctx.platformApiUrl, false, ctx.appCode || 'TESTAPP'); } catch (e) { threw = true; }
  assert_(threw, 'Tiket palsu ditolak server.');
}

function testGenericCrud(ctx) {
  need_(ctx.ssId && ctx.headersMap && ctx.headersMap.ZZ_TEST_CRUD, 'Butuh ssId + ZZ_TEST_CRUD.');
  var actor = systemActor(), id = 'CRUD-' + new Date().getTime();
  var n0 = readRecordsNoLock(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap).length;
  try {
    var ins = apiSave(ctx.ssId, 'ZZ_TEST_CRUD', { id: id, nama: 'awal' }, actor, ctx.headersMap);
    assert_(ins.success && ins.data, 'INSERT: ' + (ins.error || 'ok'));
    assert_(readRecordsNoLock(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap).length === n0 + 1, 'INSERT +1 baris.');
    var upd = apiSave(ctx.ssId, 'ZZ_TEST_CRUD', { id: id, nama: 'ubah' }, actor, ctx.headersMap);
    assert_(upd.success, 'UPDATE: ' + (upd.error || 'ok'));
    assert_(readRecordsNoLock(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap).length === n0 + 1, 'UPDATE tidak nambah baris.');
    var got = apiGet(ctx.ssId, 'ZZ_TEST_CRUD', id, {}, ctx.headersMap);
    assert_(got.success && got.data && got.data.nama === 'ubah', 'GET memantulkan update.');
    var del = apiDelete(ctx.ssId, 'ZZ_TEST_CRUD', id, actor, ctx.headersMap);
    assert_(del.success, 'SOFT DELETE: ' + (del.error || 'ok'));
  } finally {
    hardDeleteRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', id, actor);
    assert_(readRecordsNoLock(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap).length === n0, 'Bersih total.');
  }
}

// ==================== v2.1 TEST ====================

function testRoleLevelsV21(ctx) {
  assert_(MASTER_ROLE_LEVELS.viewer === 0, 'viewer=0');
  assert_(MASTER_ROLE_LEVELS.user === 1, 'user=1');
  assert_(MASTER_ROLE_LEVELS.verifikator === 2, 'verifikator=2');
  assert_(MASTER_ROLE_LEVELS.admin === 3, 'admin=3');
  assert_(MASTER_ROLE_LEVELS.super === 4, 'super=4');
  assert_(Object.keys(MASTER_ROLE_LEVELS).length === 5, '5 level kanonik.');
}

function testDateUtilsV21(ctx) {
  var umur = hitungUmur(new Date(2000, 0, 15), new Date(2026, 8, 12));
  assert_(umur === 26, 'Umur 2000-01-15 s.d. 2026-09-12 = 26, dapat: ' + umur);
  var umurBelumUlangTahun = hitungUmur(new Date(2000, 11, 31), new Date(2026, 8, 12));
  assert_(umurBelumUlangTahun === 25, 'Umur belum ultah = 25, dapat: ' + umurBelumUlangTahun);

  var durasi = hitungDurasiHari('2026-09-01', '2026-09-12');
  assert_(durasi === 11, 'Durasi 01→12 Sep = 11 hari, dapat: ' + durasi);

  var menit = hitungDurasiMenit('08:30', '10:45');
  assert_(menit === 135, 'Durasi 08:30→10:45 = 135 menit, dapat: ' + menit);
  assert_(hitungDurasiMenit('10:00', '08:00') === 0, 'Durasi negatif = 0.');

  assert_(parseTanggalBackend('2026-09-12') !== null, 'ISO date OK.');
  assert_(parseTanggalBackend('2026-09-12T07:30:00.000Z') !== null, 'ISO datetime OK.');
  assert_(parseTanggalBackend('12/09/2026') !== null, 'dd/MM/yyyy OK.');
  assert_(parseTanggalBackend('') === null, 'Empty string = null.');
  assert_(parseTanggalBackend(null) === null, 'Null = null.');
  assert_(parseTanggalBackend('bukan-tanggal') === null, 'Invalid = null.');
}

function testGetLevelJabatanV21(ctx) {
  assert_(getLevelJabatan({ nama_jabatan: 'Kepala Satuan Pol PP' }) === 'eselon_II', 'Kasat = eselon_II.');
  assert_(getLevelJabatan({ nama_jabatan: 'Sekretaris Dinas' }) === 'sekretaris', 'Sekretaris.');
  assert_(getLevelJabatan({ nama_jabatan: 'Kepala Bidang Penegakan' }) === 'kabid', 'Kabid.');
  assert_(getLevelJabatan({ nama_jabatan: 'Kasubbag Umum' }) === 'kasubbag', 'Kasubbag.');
  assert_(getLevelJabatan({ nama_jabatan: 'Kepala Seksi Trantibum' }) === 'kasi', 'Kasi.');
  assert_(getLevelJabatan({ nama_jabatan: 'Analis Ahli Madya' }) === 'jft_madya', 'Ahli Madya.');
  assert_(getLevelJabatan({ nama_jabatan: 'Analis Ahli Muda' }) === 'jft_muda', 'Ahli Muda.');
  assert_(getLevelJabatan({ nama_jabatan: 'Pemula' }) === 'jft_terampil', 'Pemula = terampil.');
  assert_(getLevelJabatan({ jenis_jabatan: 'UMUM' }) === 'staf_umum', 'Jenis UMUM.');
  assert_(getLevelJabatan({ jenis_jabatan: 'FUNGSIONAL' }) === 'staf_fungsional', 'Jenis FUNGSIONAL.');
  assert_(getLevelJabatan(null) === 'tidak_diketahui', 'Null.');
  assert_(getLevelJabatan({}) === 'staf_lainnya', 'Kosong = staf_lainnya.');
}

function testGetUnitBawahanV21(ctx) {
  var units = [
    { unit_id: 'A', parent_unit_id: '' },
    { unit_id: 'B', parent_unit_id: 'A' },
    { unit_id: 'C', parent_unit_id: 'A' },
    { unit_id: 'D', parent_unit_id: 'B' },
    { unit_id: 'E', parent_unit_id: 'D' }
  ];

  var withSelf = getUnitBawahanSimple(units, 'A');
  assert_(withSelf.indexOf('A') !== -1, 'includeSelf=true: A ada.');
  assert_(withSelf.indexOf('B') !== -1, 'B ada.');
  assert_(withSelf.indexOf('C') !== -1, 'C ada.');
  assert_(withSelf.indexOf('D') !== -1, 'D ada.');
  assert_(withSelf.indexOf('E') !== -1, 'E ada.');
  assert_(withSelf.length === 5, 'Total 5 unit.');

  var withoutSelf = getUnitBawahanSimple(units, 'A', false);
  assert_(withoutSelf.indexOf('A') === -1, 'includeSelf=false: A TIDAK ada.');
  assert_(withoutSelf.length === 4, 'Total 4 bawahan.');

  var fromB = getUnitBawahanSimple(units, 'B');
  assert_(fromB.length === 3 && fromB.indexOf('B') !== -1, 'Dari B: B,D,E.');

  var leaf = getUnitBawahanSimple(units, 'C');
  assert_(leaf.length === 1 && leaf[0] === 'C', 'Leaf C hanya dirinya.');

  var ghost = getUnitBawahanSimple(units, 'Z');
  assert_(ghost.length === 1 && ghost[0] === 'Z', 'Unit tak dikenal = dirinya saja.');

  assert_(getUnitBawahanSimple(null, 'A').length === 0, 'Input null = [].');
  assert_(getUnitBawahanSimple(units, '').length === 0, 'Unit ID kosong = [].');
}

function testActionNotFoundV21(ctx) {
  need_(ctx.ssId && ctx.headersMap, 'Butuh ssId + headersMap.');
  var cfg = { appCode: 'TEST_V21', spreadsheetId: ctx.ssId, headersMap: ctx.headersMap };
  var admin = mintTestSession_(cfg, 'admin', 'admin@example.com');
  try {
    var res = dispatchAction({ action: 'aksi_aneh_tidak_ada_xyz', token: admin.token, data: {} }, cfg);
    assert_(!res.success, 'Aksi tak dikenal GAGAL.');
    assert_(res.code === 'NOT_FOUND', 'code = NOT_FOUND, dapat: ' + res.code);
    assert_(res.error && res.error.indexOf('tidak dikenali') !== -1, 'Pesan error sesuai.');
  } finally {
    burnTestSession_(admin.prefix, admin.token);
  }
}

function testSessionExpiredV21(ctx) {
  need_(ctx.ssId, 'Butuh ssId.');
  var cfg = { appCode: 'TEST_V21', spreadsheetId: ctx.ssId };
  var prefix = sessionPrefixFor_(cfg);

  var res1 = checkAuth('TOKEN_NGAWUR_XYZ', 'viewer', prefix);
  assert_(!res1.success, 'Token ngawur GAGAL.');
  assert_(res1.code === 'UNAUTHORIZED', 'code UNAUTHORIZED, dapat: ' + res1.code);

  var res2 = checkAuth('', 'viewer', prefix);
  assert_(!res2.success, 'Token kosong GAGAL.');
  assert_(res2.code === 'UNAUTHORIZED', 'code UNAUTHORIZED untuk kosong.');

  var s = mintTestSession_(cfg, 'viewer', 'v@example.com');
  try {
    var res3 = checkAuth(s.token, 'admin', s.prefix);
    assert_(!res3.success, 'Viewer tidak boleh admin-level.');
    assert_(res3.code === 'FORBIDDEN', 'code FORBIDDEN, dapat: ' + res3.code);
  } finally {
    burnTestSession_(s.prefix, s.token);
  }
}

// ==================== v2.2 TEST BARU ====================

function testNormUtilV22(ctx) {
  assert_(normId_('  hello  ') === 'hello', 'normId_ trim.');
  assert_(normId_(null) === '', 'normId_ null -> empty.');
  assert_(normId_(undefined) === '', 'normId_ undefined -> empty.');
  assert_(normId_(123) === '123', 'normId_ number -> string.');
  assert_(normId_(0) === '0', 'normId_ zero -> "0".');
  assert_(normStr_('  HeLLo  ') === 'hello', 'normStr_ trim + lowercase.');
  assert_(normStr_(null) === '', 'normStr_ null -> empty.');

  assert_(normId('  x  ') === 'x', 'public normId.');
  assert_(normStr('  X  ') === 'x', 'public normStr.');
}

function testParseDateV22(ctx) {
  var d = parseDate_('12/09/2026');
  assert_(d && d.getFullYear() === 2026 && d.getMonth() === 8 && d.getDate() === 12,
          'parseDate_ dd/MM/yyyy: dapat ' + (d ? d.toISOString() : 'null'));

  var d2 = parseDate_('2026-09-12');
  assert_(d2 && d2.getFullYear() === 2026 && d2.getMonth() === 8 && d2.getDate() === 12, 'parseDate_ ISO.');

  var d3 = parseDate_('2026-09-12T07:30:00.000Z');
  assert_(d3 && d3.getFullYear() === 2026, 'parseDate_ ISO datetime.');

  assert_(parseDate_(null) === null, 'parseDate_ null -> null.');
  assert_(parseDate_('') === null, 'parseDate_ empty -> null.');
  assert_(parseDate_('bukan-tanggal') === null, 'parseDate_ invalid -> null.');

  var inp = new Date(2026, 8, 12);
  assert_(parseDate_(inp) === inp, 'parseDate_ Date object passthrough.');

  assert_(parseDate('12/09/2026') instanceof Date, 'public parseDate.');
}

function testWhitelistV22(ctx) {
  assert_(whitelist_('terjadwal', ['Terjadwal', 'Selesai'], 'x') === 'Terjadwal', 'whitelist_ lowercase input -> kanonik.');
  assert_(whitelist_('TERJADWAL', ['Terjadwal', 'Selesai'], 'x') === 'Terjadwal', 'whitelist_ uppercase input -> kanonik.');
  assert_(whitelist_('Selesai', ['Terjadwal', 'Selesai'], 'x') === 'Selesai', 'whitelist_ exact.');
  assert_(whitelist_('  Terjadwal  ', ['Terjadwal'], 'x') === 'Terjadwal', 'whitelist_ trim.');

  var threw = false;
  try { whitelist_('ngawur', ['A', 'B'], 'field_x'); } catch (e) { threw = e.message.indexOf('field_x') !== -1; }
  assert_(threw, 'whitelist_ tolak nilai invalid + sebut field.');

  var threw2 = false;
  try { whitelist_('A', null, 'x'); } catch (e) { threw2 = true; }
  assert_(threw2, 'whitelist_ tolak non-array.');

  assert_(whitelist('a', ['A'], 'x') === 'A', 'public whitelist.');
}

function testValidateFieldsV22(ctx) {
  validateFields_({ a: 1, b: 'x' }, ['a', 'b']);

  var threw1 = false;
  try { validateFields_({ a: '  ' }, ['a']); } catch (e) { threw1 = true; }
  assert_(threw1, 'validateFields_ tolak string kosong.');

  var threw2 = false;
  try { validateFields_({ a: null }, ['a']); } catch (e) { threw2 = true; }
  assert_(threw2, 'validateFields_ tolak null.');

  var threw3 = false;
  try { validateFields_({}, ['a']); } catch (e) { threw3 = true; }
  assert_(threw3, 'validateFields_ tolak field tidak ada.');

  validateFields_({ a: 1 }, []);

  var threw4 = false;
  try { validateFields_(null, ['a']); } catch (e) { threw4 = true; }
  assert_(threw4, 'validateFields_ tolak non-object.');

  var threw5 = false;
  try { validateFields({}, ['x']); } catch (e) { threw5 = true; }
  assert_(threw5, 'public validateFields.');
}

function testGenUniqueCodeV22(ctx) {
  // 1. Tanpa ssId -> error
  var threw = false;
  try { genUniqueCode_('X-', 'ZZ_TEST_CRUD', 'id', 3, '', {}); } catch (e) { threw = true; }
  assert_(threw, 'genUniqueCode_ butuh ssId.');

  // 2. Tanpa sheetName/field -> error
  var threw2 = false;
  try { genUniqueCode_('X-', '', 'id', 3, 'FAKE', {}); } catch (e) { threw2 = true; }
  assert_(threw2, 'genUniqueCode_ butuh sheetName.');

  // 3. Test fungsional deterministik
  need_(ctx.ssId && ctx.headersMap && ctx.headersMap.ZZ_TEST_CRUD, 'Butuh ssId + ZZ_TEST_CRUD.');

  var sh = ensureSheet(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap, {});
  wipeSheet_(sh);
  invalidateSheetCache('ZZ_TEST_CRUD', ctx.ssId);

  var prefix = 'UNIQ' + Date.now() + '-';

  var code1 = genUniqueCode_(prefix, 'ZZ_TEST_CRUD', 'id', 3, ctx.ssId, ctx.headersMap);
  assert_(code1 === prefix + '001', 'genUniqueCode_ sheet kosong = 001, dapat: ' + code1);

  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: code1, nama: 'first' }, false, systemActor(), ctx.headersMap);
  var code2 = genUniqueCode_(prefix, 'ZZ_TEST_CRUD', 'id', 3, ctx.ssId, ctx.headersMap);
  assert_(code2 === prefix + '002', 'genUniqueCode_ setelah 001 = 002, dapat: ' + code2);

  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: code2, nama: 'second' }, false, systemActor(), ctx.headersMap);
  writeRecordNoLock(ctx.ssId, 'ZZ_TEST_CRUD', { id: 'DUP-' + Date.now(), nama: 'junk' }, false, systemActor(), ctx.headersMap);
  var code3 = genUniqueCode_(prefix, 'ZZ_TEST_CRUD', 'id', 3, ctx.ssId, ctx.headersMap);
  assert_(code3 === prefix + '003', 'genUniqueCode_ tidak terpengaruh ID lain = 003, dapat: ' + code3);

  var codeOther = genUniqueCode_('OTHER' + Date.now() + '-', 'ZZ_TEST_CRUD', 'id', 3, ctx.ssId, ctx.headersMap);
  assert_(/\-001$/.test(codeOther), 'genUniqueCode_ prefix lain = 001, dapat: ' + codeOther);

  wipeSheet_(sh);
  invalidateSheetCache('ZZ_TEST_CRUD', ctx.ssId);

  var code4 = genUniqueCode('PUB' + Date.now() + '-', 'ZZ_TEST_CRUD', 'id', 3, ctx.ssId, ctx.headersMap);
  assert_(code4.indexOf('PUB') === 0 && /\d{3}$/.test(code4), 'public genUniqueCode: ' + code4);
}

function testRequireRoleV22(ctx) {
  assert_(requireRole_({ role: 'admin' }, 'verifikator') === true, 'requireRole_ admin>=verifikator.');
  assert_(requireRole_({ role: 'super' }, 'super') === true, 'requireRole_ super>=super.');
  assert_(requireRole_({ role: 'user' }, 'viewer') === true, 'requireRole_ user>=viewer.');

  var threw = false;
  try { requireRole_({ role: 'viewer' }, 'admin'); } catch (e) { threw = true; }
  assert_(threw, 'requireRole_ viewer>=admin ditolak.');

  var threw2 = false;
  try { requireRole_(null, 'user'); } catch (e) { threw2 = true; }
  assert_(threw2, 'requireRole_ null user diperlakukan viewer.');

  var customMap = { custom_role: 5, admin: 3, viewer: 0, user: 1, verifikator: 2, super: 4 };
  assert_(requireRole_({ role: 'custom_role' }, 'admin', customMap) === true, 'requireRole_ custom level tinggi.');

  var threw3 = false;
  try { requireRole({ role: 'viewer' }, 'admin'); } catch (e) { threw3 = true; }
  assert_(threw3, 'public requireRole tolak viewer>=admin.');
}

function testRoleGateV222(ctx) {
  // 1. levelOf_: viewer = 0, bukan 1.
  assert_(levelOf_('viewer', MASTER_ROLE_LEVELS) === 0, 'levelOf_ viewer = 0.');
  assert_(levelOf_('user', MASTER_ROLE_LEVELS) === 1, 'levelOf_ user = 1.');
  assert_(levelOf_('admin', MASTER_ROLE_LEVELS) === 3, 'levelOf_ admin = 3.');
  assert_(levelOf_('role_ngawur', MASTER_ROLE_LEVELS) === 0, 'levelOf_ role tak dikenal = 0 (fail-closed).');

  // 2. Gating baca: viewer (0) >= viewer (0) harus LOLOS.
  assert_(levelOf_('viewer', MASTER_ROLE_LEVELS) >= levelOf_('viewer', MASTER_ROLE_LEVELS), 'viewer lolos gate baca viewer.');

  // 3. Gating tulis: viewer (0) < user (1) harus TERTOLAK.
  assert_(levelOf_('viewer', MASTER_ROLE_LEVELS) < levelOf_('user', MASTER_ROLE_LEVELS), 'viewer ditolak gate tulis user.');

  // 4. requireRole_ tetap konsisten (pola referensi yang benar).
  assert_(requireRole_({ role: 'viewer' }, 'viewer') === true, 'requireRole_ viewer>=viewer lolos.');
  var threw = false;
  try { requireRole_({ role: 'viewer' }, 'user'); } catch (e) { threw = true; }
  assert_(threw, 'requireRole_ viewer>=user ditolak.');

  // 5. checkAuth & levelOf_ tidak mengandung fallback buggy `|| 1`.
  assert_(checkAuth.toString().indexOf('roleMap[userRole] || 1') === -1, 'checkAuth bebas fallback || 1.');
  assert_(levelOf_.toString().indexOf('|| 1') === -1, 'levelOf_ bebas fallback || 1.');
}

function testCheckRoleV22(ctx) {
  var map = { save_jadwal: 'user', delete_jadwal: 'admin' };

  var r1 = checkRole_({ role: 'user' }, 'save_jadwal', map);
  assert_(r1.allowed === true && r1.minRole === 'user', 'checkRole user save_jadwal allowed.');

  var r2 = checkRole_({ role: 'user' }, 'delete_jadwal', map);
  assert_(r2.allowed === false && r2.minRole === 'admin' && r2.error, 'checkRole user delete_jadwal denied.');

  var r3 = checkRole_({ role: 'user' }, 'action_tak_ada_map', map);
  assert_(r3.allowed === true && r3.minRole === null, 'checkRole action unmapped = bebas.');

  var r4 = checkRole_({ role: 'admin' }, 'delete_jadwal', map);
  assert_(r4.allowed === true, 'checkRole admin delete_jadwal allowed.');

  var r5 = checkRole_({ role: 'super' }, 'delete_jadwal', map);
  assert_(r5.allowed === true, 'checkRole super delete_jadwal allowed.');

  var r6 = checkRole_({ role: 'viewer' }, 'whatever', {});
  assert_(r6.allowed === true, 'checkRole map kosong = bebas.');

  var r7 = checkRole({ role: 'viewer' }, 'save_jadwal', map);
  assert_(r7.allowed === false, 'public checkRole.');
}

function testGetRoleForEmailV22(ctx) {
  var mockStore = {
    _data: {},
    getProperty: function(k) { return this._data[k] || null; }
  };

  assert_(getRoleForEmail_('', mockStore) === 'viewer', 'getRoleForEmail empty -> viewer.');
  assert_(getRoleForEmail_('x@y.com', mockStore) === 'viewer', 'getRoleForEmail tanpa whitelist -> viewer.');

  mockStore._data.ADMIN_EMAILS = 'admin1@test.com,admin2@test.com';
  assert_(getRoleForEmail_('admin1@test.com', mockStore) === 'admin', 'getRoleForEmail admin exact.');
  assert_(getRoleForEmail_('ADMIN1@TEST.COM', mockStore) === 'admin', 'getRoleForEmail admin case-insensitive.');
  assert_(getRoleForEmail_('other@test.com', mockStore) === 'viewer', 'getRoleForEmail non-whitelist -> viewer.');

  mockStore._data.VERIFIKATOR_EMAILS = 'verif@test.com';
  assert_(getRoleForEmail_('verif@test.com', mockStore) === 'verifikator', 'getRoleForEmail verifikator.');

  mockStore._data.ADMIN_EMAILS = 'both@test.com';
  mockStore._data.VERIFIKATOR_EMAILS = 'both@test.com';
  assert_(getRoleForEmail_('both@test.com', mockStore) === 'admin', 'getRoleForEmail admin prioritas.');

  assert_(getRoleForEmail('x@y.com', mockStore) === 'viewer', 'public getRoleForEmail.');
}

function testIsAllowedConfigKeyV22(ctx) {
  assert_(isAllowedConfigKey_('app_title') === true, 'isAllowedConfigKey app_title.');
  assert_(isAllowedConfigKey_('instansi') === true, 'isAllowedConfigKey instansi.');
  assert_(isAllowedConfigKey_('target_jp_pns') === true, 'isAllowedConfigKey target_jp_pns.');
  assert_(isAllowedConfigKey_('alert_h_days_lisensi') === true, 'isAllowedConfigKey alert_h_days_lisensi.');

  assert_(isAllowedConfigKey_('SPREADSHEET_ID') === false, 'isAllowedConfigKey SPREADSHEET_ID ditolak.');
  assert_(isAllowedConfigKey_('PLATFORM_API_URL') === false, 'isAllowedConfigKey PLATFORM_API_URL ditolak.');
  assert_(isAllowedConfigKey_('ADMIN_EMAILS') === false, 'isAllowedConfigKey ADMIN_EMAILS ditolak (security).');
  assert_(isAllowedConfigKey_('VERIFIKATOR_EMAILS') === false, 'isAllowedConfigKey VERIFIKATOR_EMAILS ditolak (security).');

  assert_(isAllowedConfigKey_('ADMIN_EMAILS', ['ADMIN_EMAILS']) === true, 'isAllowedConfigKey via extraKeys.');
  assert_(isAllowedConfigKey_('app_title', ['ADMIN_EMAILS']) === true, 'isAllowedConfigKey app_title + extraKeys.');
  assert_(isAllowedConfigKey_('HACK_KEY', ['ADMIN_EMAILS']) === false, 'isAllowedConfigKey non-extra ditolak.');

  assert_(isAllowedConfigKey_('app_title', null) === true, 'isAllowedConfigKey null extraKeys.');
  assert_(isAllowedConfigKey_('app_title', 'string') === true, 'isAllowedConfigKey non-array extraKeys.');

  assert_(isAllowedConfigKey('app_title') === true, 'public isAllowedConfigKey true.');
  assert_(isAllowedConfigKey('SPREADSHEET_ID') === false, 'public isAllowedConfigKey false.');
}

// ==================== v2.3.0 TEST BARU (C1/C2/C3) ====================

// C3: todayIsoLocal_() & dateKey10_() — sadar zona waktu Script.
function testTodayIsoLocalV230(ctx) {
  var tz = Session.getScriptTimeZone();
  var expected = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var got = todayIsoLocal_();
  assert_(got === expected, 'todayIsoLocal_ = formatDate(Local) : got=' + got + ' exp=' + expected);
  assert_(/^\d{4}-\d{2}-\d{2}$/.test(got), 'todayIsoLocal_ format yyyy-MM-dd.');

  // Wrapper publik
  assert_(todayIsoLocal() === got, 'public todayIsoLocal konsisten.');

  // todayIso() LAMA masih ada & tidak berubah (backward-compat)
  var old = todayIso();
  assert_(/^\d{4}-\d{2}-\d{2}$/.test(old), 'todayIso() lama tetap ada.');
}

// C3: dateKey10_() — konversi multi-format → 'yyyy-MM-dd' lokal.
function testDateKey10V230(ctx) {
  var tz = Session.getScriptTimeZone();

  // 1. Date object → format lokal
  var d1 = new Date(2026, 8, 19, 14, 30); // 19 Sep 2026 14:30 LOKAL
  assert_(dateKey10_(d1) === '2026-09-19', 'dateKey10_ Date → 2026-09-19, got=' + dateKey10_(d1));

  // 2. String 'yyyy-MM-dd' murni → potong 10 char
  assert_(dateKey10_('2026-09-19') === '2026-09-19', 'dateKey10_ yyyy-MM-dd passthrough.');

  // 3. String ISO penuh → parse lalu format LOKAL (fix UTC)
  // '2026-09-19T00:00:00.000Z' = 19 Sep 07:00 WIB → tetap 19 Sep lokal.
  // '2026-09-18T17:00:00.000Z' = 19 Sep 00:00 WIB → tetap 19 Sep lokal (bukan 18).
  assert_(dateKey10_('2026-09-19T00:00:00.000Z') === '2026-09-19', 'dateKey10_ ISO tengah malam UTC → 19 Sep WIB.');
  assert_(dateKey10_('2026-09-18T17:00:00.000Z') === '2026-09-19', 'dateKey10_ ISO 17:00 UTC → 19 Sep WIB (bug lama = 18).');

  // 4. String legacy 'dd/MM/yyyy'
  assert_(dateKey10_('19/09/2026') === '2026-09-19', 'dateKey10_ dd/MM/yyyy legacy.');

  // 5. String 'yyyy-MM-dd HH:mm' → parse lalu format lokal
  assert_(dateKey10_('2026-09-19 14:30') === '2026-09-19', 'dateKey10_ yyyy-MM-dd HH:mm.');

  // 6. Nilai kosong → ''
  assert_(dateKey10_(null) === '', 'dateKey10_ null → empty.');
  assert_(dateKey10_('') === '', 'dateKey10_ empty → empty.');
  assert_(dateKey10_(undefined) === '', 'dateKey10_ undefined → empty.');

  // 7. Wrapper publik
  assert_(dateKey10('2026-09-19') === '2026-09-19', 'public dateKey10.');
}

// C1: paginate_() — potong array + meta.
function testPaginateV230(ctx) {
  var rows = [];
  for (var i = 1; i <= 25; i++) rows.push({ id: i });

  // 1. Halaman normal
  var p1 = paginate_(rows, 1, 10);
  assert_(p1.success === true, 'paginate_ success.');
  assert_(p1.data.length === 10, 'paginate_ halaman 1 = 10 baris.');
  assert_(p1.data[0].id === 1 && p1.data[9].id === 10, 'paginate_ halaman 1 nilai benar.');
  assert_(p1.meta.total === 25, 'paginate_ total=25.');
  assert_(p1.meta.total_pages === 3, 'paginate_ total_pages=3.');
  assert_(p1.meta.page === 1 && p1.meta.limit === 10, 'paginate_ meta page/limit.');

  // 2. Halaman terakhir (sisa)
  var p3 = paginate_(rows, 3, 10);
  assert_(p3.data.length === 5, 'paginate_ halaman 3 = 5 baris.');
  assert_(p3.data[0].id === 21 && p3.data[4].id === 25, 'paginate_ halaman 3 nilai benar.');

  // 3. Halaman di luar range → data kosong, meta tetap benar
  var p9 = paginate_(rows, 9, 10);
  assert_(p9.data.length === 0, 'paginate_ halaman di luar range = kosong.');
  assert_(p9.meta.total_pages === 3, 'paginate_ meta total_pages tetap.');

  // 4. Input non-array → array kosong
  var pN = paginate_(null, 1, 10);
  assert_(pN.data.length === 0 && pN.meta.total === 0, 'paginate_ null → kosong.');

  // 5. page/limit invalid → default 1/10
  var pDef = paginate_(rows, 0, 0);
  assert_(pDef.meta.page === 1 && pDef.meta.limit === 10, 'paginate_ default page/limit.');

  // 6. Wrapper publik
  var pp = paginate(rows, 2, 5);
  assert_(pp.data.length === 5 && pp.data[0].id === 6, 'public paginate.');
}

// C2: matchSearch_() — substring case-insensitive.
function testMatchSearchV230(ctx) {
  var row = { deskripsi: 'Laporan Patroli Wilayah', hasil: 'Selesai 100%', kendala: '' };

  // 1. Match salah satu field
  assert_(matchSearch_(row, 'patroli', ['deskripsi', 'hasil']) === true, 'matchSearch_ patroli di deskripsi.');
  assert_(matchSearch_(row, 'selesai', ['deskripsi', 'hasil']) === true, 'matchSearch_ selesai di hasil.');
  assert_(matchSearch_(row, '100%', ['hasil']) === true, 'matchSearch_ simbol 100%.');

  // 2. Case-insensitive
  assert_(matchSearch_(row, 'PATROLI', ['deskripsi']) === true, 'matchSearch_ case-insensitive.');
  assert_(matchSearch_(row, 'PaTrOlI', ['deskripsi']) === true, 'matchSearch_ mixed case.');

  // 3. Tidak match
  assert_(matchSearch_(row, 'kebakaran', ['deskripsi', 'hasil']) === false, 'matchSearch_ tidak match.');

  // 4. q kosong → true (selalu lolos)
  assert_(matchSearch_(row, '', ['deskripsi']) === true, 'matchSearch_ q kosong → true.');
  assert_(matchSearch_(row, null, ['deskripsi']) === true, 'matchSearch_ q null → true.');
  assert_(matchSearch_(row, '   ', ['deskripsi']) === true, 'matchSearch_ q whitespace → true.');

  // 5. fields kosong / non-array → false (cermin si-lahar: tidak ada field
  //    dicari = tidak match). Perilaku konsisten untuk [] dan null.
  assert_(matchSearch_(row, 'apa saja', []) === false, 'matchSearch_ fields [] → false.');
  assert_(matchSearch_(row, 'apa saja', null) === false, 'matchSearch_ fields null → false.');

  // 6. Field kosong di row diabaikan
  assert_(matchSearch_(row, 'x', ['kendala']) === false, 'matchSearch_ field kosong diabaikan.');

  // 7. Wrapper publik
  assert_(matchSearch(row, 'patroli', ['deskripsi']) === true, 'public matchSearch.');
}

// ==================== v2.4.0 TEST BARU (C4/C5/C8) ====================

// C5: assertOwnership_() & checkOwnership_()
function testAssertOwnershipV240(ctx) {
  var admin = { role: 'admin', pegawai_id: 'PEG-ADMIN' };
  var userA = { role: 'user', pegawai_id: 'PEG-A', id: 'PEG-A' };
  var userB = { role: 'user', pegawai_id: 'PEG-B' };
  var viewer = { role: 'viewer', pegawai_id: 'PEG-A' };

  // 1. Pemilik sendiri lolos
  assert_(assertOwnership_(userA, 'PEG-A') === true, 'assertOwnership pemilik lolos.');

  // 2. Bukan pemilik → throw
  var threw = false;
  try { assertOwnership_(userA, 'PEG-B'); } catch (e) { threw = e.message.indexOf('milik sendiri') !== -1; }
  assert_(threw, 'assertOwnership bukan pemilik ditolak.');

  // 3. Admin bypass (default allowAdminBypass=true)
  assert_(assertOwnership_(admin, 'PEG-B') === true, 'assertOwnership admin bypass.');
  assert_(assertOwnership_({ role: 'super', pegawai_id: 'X' }, 'PEG-B') === true, 'assertOwnership super bypass.');

  // 4. Admin bypass dimatikan → admin juga ditolak bila bukan pemilik
  var threw2 = false;
  try { assertOwnership_(admin, 'PEG-B', { allowAdminBypass: false }); } catch (e) { threw2 = true; }
  assert_(threw2, 'assertOwnership admin tanpa bypass ditolak.');

  // 5. checkOwnership versi non-throw
  var ok = checkOwnership_(userA, 'PEG-A');
  assert_(ok.allowed === true, 'checkOwnership allowed.');
  var nok = checkOwnership_(userA, 'PEG-B');
  assert_(nok.allowed === false && nok.error, 'checkOwnership denied + error.');

  // 6. Actor tanpa pegawai_id → error
  var threw3 = false;
  try { assertOwnership_({ role: 'user' }, 'PEG-A'); } catch (e) { threw3 = e.message.indexOf('pegawai_id') !== -1; }
  assert_(threw3, 'assertOwnership actor tanpa pegawai_id ditolak.');

  // 7. ownerId kosong → error
  var threw4 = false;
  try { assertOwnership_(userA, ''); } catch (e) { threw4 = e.message.indexOf('pemilik') !== -1; }
  assert_(threw4, 'assertOwnership ownerId kosong ditolak.');

  // 8. Wrapper publik
  assert_(assertOwnership(userA, 'PEG-A') === true, 'public assertOwnership.');
  assert_(checkOwnership(userA, 'PEG-B').allowed === false, 'public checkOwnership.');

  // 9. Viewer yang kebetulan pemilik → lolos (role viewer tapi pemilik)
  assert_(assertOwnership_(viewer, 'PEG-A') === true, 'assertOwnership viewer-pemilik lolos (bukan cek role, hanya kepemilikan).');
}

// C4: validateTransition_()
function testValidateTransitionV240(ctx) {
  var peta = {
    draft: ['baru', 'batal'],
    baru: ['diproses', 'batal'],
    diproses: ['selesai', 'batal'],
    selesai: [],
    batal: []
  };

  // 1. Transisi valid
  assert_(validateTransition_('draft', 'baru', peta, false) === true, 'validateTransition draft→baru valid.');
  assert_(validateTransition_('baru', 'diproses', peta, false) === true, 'validateTransition baru→diproses valid.');
  assert_(validateTransition_('diproses', 'selesai', peta, false) === true, 'validateTransition diproses→selesai valid.');

  // 2. Case-insensitive
  assert_(validateTransition_('DRAFT', 'BARU', peta, false) === true, 'validateTransition case-insensitive.');
  assert_(validateTransition_('Draft', 'Batal', peta, false) === true, 'validateTransition Draft→Batal.');

  // 3. Sama status → lolos (no-op)
  assert_(validateTransition_('baru', 'baru', peta, false) === true, 'validateTransition same status lolos.');

  // 4. Transisi tidak diizinkan → throw
  var threw = false;
  try { validateTransition_('draft', 'selesai', peta, false); } catch (e) { threw = e.message.indexOf('tidak diizinkan') !== -1; }
  assert_(threw, 'validateTransition draft→selesai ditolak.');

  var threw2 = false;
  try { validateTransition_('selesai', 'baru', peta, false); } catch (e) { threw2 = true; }
  assert_(threw2, 'validateTransition selesai→baru ditolak.');

  // 5. Status tidak dikenal → throw
  var threw3 = false;
  try { validateTransition_('status_ngawur', 'baru', peta, false); } catch (e) { threw3 = e.message.indexOf('tidak dikenal') !== -1; }
  assert_(threw3, 'validateTransition status tidak dikenal ditolak.');

  // 6. Peta tidak valid → throw
  var threw4 = false;
  try { validateTransition_('draft', 'baru', null, false); } catch (e) { threw4 = true; }
  assert_(threw4, 'validateTransition peta null ditolak.');

  // 7. isAdmin bypass → lolos walau peta melarang
  assert_(validateTransition_('draft', 'selesai', peta, true) === true, 'validateTransition isAdmin bypass.');
  assert_(validateTransition_('selesai', 'draft', peta, true) === true, 'validateTransition super bypass.');

  // 8. Wrapper publik
  assert_(validateTransition('draft', 'baru', peta, false) === true, 'public validateTransition.');

  // 9. Kosong → throw
  var threw5 = false;
  try { validateTransition_('', 'baru', peta, false); } catch (e) { threw5 = true; }
  assert_(threw5, 'validateTransition current kosong ditolak.');
}

// C8: getThemeConfig_() & buildThemeCss_()
function testThemeConfigV240(ctx) {
  // Mock Properties store
  var mockStore = {
    _data: {},
    getProperty: function(k) { return this._data[k] || null; },
    setProperty: function(k, v) { this._data[k] = v; }
  };

  // 1. Default bila kosong → emerald
  var def = getThemeConfig_(mockStore);
  assert_(def.code === 'emerald' && def.primary === '#059669', 'getThemeConfig default emerald.');

  // 2. THEME_CODE legacy
  mockStore._data.THEME_CODE = 'sky';
  var sky = getThemeConfig_(mockStore);
  assert_(sky.code === 'sky' && sky.primary === '#0284c7', 'getThemeConfig THEME_CODE sky.');
  mockStore._data.THEME_CODE = '';

  // 3. THEME_JSON sebagai code string
  mockStore._data.THEME_JSON = 'amber';
  var amber = getThemeConfig_(mockStore);
  assert_(amber.code === 'amber' && amber.primary === '#d97706', 'getThemeConfig THEME_JSON code amber.');

  // 4. THEME_JSON sebagai JSON object custom
  mockStore._data.THEME_JSON = JSON.stringify({ code: 'custom', primary: '#ff0000', primaryDark: '#cc0000', primaryLight: '#fff0f0', primaryLighter: '#ffe0e0', primaryText: '#660000', primaryAccent: '#ff6666', primaryRgb: '255, 0, 0', label: 'Custom Red' });
  var custom = getThemeConfig_(mockStore);
  assert_(custom.primary === '#ff0000' && custom.code === 'custom', 'getThemeConfig custom JSON.');

  // 5. THEME_JSON invalid → fallback default
  mockStore._data.THEME_JSON = 'not-json-{{';
  var fallback = getThemeConfig_(mockStore);
  assert_(fallback.code === 'emerald', 'getThemeConfig invalid JSON fallback.');

  // 6. buildThemeCss_ dari code
  var cssEmerald = buildThemeCss_('emerald');
  assert_(cssEmerald.indexOf('--primary:#059669') !== -1, 'buildThemeCss emerald.');
  assert_(cssEmerald.indexOf(':root') === 0, 'buildThemeCss diawali :root.');

  // 7. buildThemeCss_ dari object
  var cssCustom = buildThemeCss_(custom);
  assert_(cssCustom.indexOf('--primary:#ff0000') !== -1, 'buildThemeCss custom.');

  // 8. getThemeCss_ (store → css)
  mockStore._data.THEME_JSON = 'violet';
  var cssViaStore = getThemeCss_(mockStore);
  assert_(cssViaStore.indexOf('--primary:#7c3aed') !== -1, 'getThemeCss via store violet.');

  // 9. Wrapper publik
  assert_(getThemeConfig(mockStore).code === 'violet', 'public getThemeConfig.');
  assert_(buildThemeCss('teal').indexOf('--primary:#0d9488') !== -1, 'public buildThemeCss.');
  assert_(getThemeCss(mockStore).indexOf(':root') === 0, 'public getThemeCss.');
}

// C6: periodeBulan_(), dalamPeriode_(), hitungHariKerja_()
function testPeriodeHariKerjaV240(ctx) {
  // 1. periodeBulan dari berbagai format
  assert_(periodeBulan_('2026-09-19') === '2026-09', 'periodeBulan yyyy-MM-dd.');
  assert_(periodeBulan_('19/09/2026') === '2026-09', 'periodeBulan dd/MM/yyyy.');
  assert_(periodeBulan_(new Date(2026, 8, 19)) === '2026-09', 'periodeBulan Date.');
  assert_(periodeBulan_('') === '', 'periodeBulan empty → empty.');
  assert_(periodeBulan_(null) === '', 'periodeBulan null → empty.');
  assert_(periodeBulan('2026-09-19') === '2026-09', 'public periodeBulan.');

  // 2. dalamPeriode dengan 'yyyy-MM'
  assert_(dalamPeriode_('2026-09-15', '2026-09') === true, 'dalamPeriode same month.');
  assert_(dalamPeriode_('2026-10-01', '2026-09') === false, 'dalamPeriode beda bulan.');
  assert_(dalamPeriode_('2026-09-19 14:30', '2026-09') === true, 'dalamPeriode dengan waktu.');
  assert_(dalamPeriode_('19/09/2026', '2026-09') === true, 'dalamPeriode dd/MM vs yyyy-MM.');

  // 3. dalamPeriode dengan exact date 'yyyy-MM-dd'
  assert_(dalamPeriode_('2026-09-19', '2026-09-19') === true, 'dalamPeriode exact date true.');
  assert_(dalamPeriode_('2026-09-20', '2026-09-19') === false, 'dalamPeriode exact date false.');

  // 4. dalamPeriode dengan {start,end}
  assert_(dalamPeriode_('2026-09-15', {start:'2026-09-10', end:'2026-09-20'}) === true, 'dalamPeriode range true.');
  assert_(dalamPeriode_('2026-09-25', {start:'2026-09-10', end:'2026-09-20'}) === false, 'dalamPeriode range false.');
  assert_(dalamPeriode_('19/09/2026', {start:'2026-09-10', end:'2026-09-20'}) === true, 'dalamPeriode range dd/MM.');

  // 5. hitungHariKerja — Senin-Jumat, tanpa libur
  // 2026-09-14 = Senin, 2026-09-18 = Jumat → 5 hari kerja
  assert_(hitungHariKerja_('2026-09-14', '2026-09-18', []) === 5, 'hitungHariKerja Mon-Fri =5.');
  // 2026-09-14 Senin s.d. 2026-09-20 Minggu → 5 (Sab-Min libur)
  assert_(hitungHariKerja_('2026-09-14', '2026-09-20', []) === 5, 'hitungHariKerja Mon-Sun =5.');
  // 2026-09-19 Sab, 2026-09-20 Min → 0
  assert_(hitungHariKerja_('2026-09-19', '2026-09-20', []) === 0, 'hitungHariKerja weekend =0.');
  // Dengan libur nasional
  assert_(hitungHariKerja_('2026-09-14', '2026-09-18', ['2026-09-16']) === 4, 'hitungHariKerja -1 libur =4.');
  assert_(hitungHariKerja_('2026-09-14', '2026-09-18', ['2026-09-19','2026-09-20']) === 5, 'hitungHariKerja libur weekend tidak ngaruh =5.');

  // 6. Edge: start > end → 0
  assert_(hitungHariKerja_('2026-09-20', '2026-09-10', []) === 0, 'hitungHariKerja start>end =0.');
  assert_(hitungHariKerja_(null, '2026-09-20', []) === 0, 'hitungHariKerja null =0.');

  // 7. Wrapper publik
  assert_(periodeBulan('2026-09-19') === '2026-09', 'public periodeBulan.');
  assert_(dalamPeriode('2026-09-15', '2026-09') === true, 'public dalamPeriode.');
  assert_(hitungHariKerja('2026-09-14', '2026-09-18', []) === 5, 'public hitungHariKerja.');
}

// C7: findUnique_() & upsertUnique_() — butuh SS
function testFindUpsertUniqueV240(ctx) {
  need_(ctx.ssId && ctx.headersMap && ctx.headersMap.ZZ_TEST_CRUD, 'Butuh ssId + ZZ_TEST_CRUD.');
  var sh = ensureSheet(ctx.ssId, 'ZZ_TEST_CRUD', ctx.headersMap, {});
  wipeSheet_(sh);
  invalidateSheetCache('ZZ_TEST_CRUD', ctx.ssId);

  var actor = systemActor();
  var uniqField = 'nama';
  var val1 = 'UNIQ-' + Date.now() + '-A';
  var val2 = 'UNIQ-' + Date.now() + '-B';

  // 1. findUnique kosong → null
  assert_(findUnique_(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, val1, ctx.headersMap) === null, 'findUnique kosong null.');

  // 2. Insert pertama via upsertUnique
  var r1 = upsertUnique_(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, { id: 'UQ-1', nama: val1, no_hp: '0811' }, actor, ctx.headersMap);
  assert_(r1.success && r1.data && r1.data.nama === val1, 'upsertUnique insert pertama.');
  assert_(r1.isUpdate === false, 'upsertUnique isUpdate false.');

  // 3. findUnique ketemu
  var found = findUnique_(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, val1, ctx.headersMap);
  assert_(found && found.id === 'UQ-1', 'findUnique ketemu.');

  // 4. findUnique case-insensitive
  var foundCI = findUnique_(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, val1.toLowerCase(), ctx.headersMap);
  assert_(foundCI && foundCI.id === 'UQ-1', 'findUnique case-insensitive.');

  // 5. upsertUnique update same PK → lolos
  var r2 = upsertUnique_(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, { id: 'UQ-1', nama: val1, no_hp: '0822' }, actor, ctx.headersMap);
  assert_(r2.success && r2.isUpdate === true, 'upsertUnique update same PK.');
  var after = findUnique_(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, val1, ctx.headersMap);
  assert_(String(after.no_hp) === '0822', 'upsertUnique update reflected: got=' + after.no_hp);

  // 6. upsertUnique duplikat PK berbeda → throw
  var threw = false;
  try { upsertUnique_(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, { id: 'UQ-2', nama: val1, no_hp: '0833' }, actor, ctx.headersMap); } catch (e) { threw = e.message.indexOf('Duplikat') !== -1; }
  assert_(threw, 'upsertUnique duplikat PK berbeda ditolak.');

  // 7. upsertUnique tanpa PK tapi unique sudah ada → inject PK existing (update)
  var r3 = upsertUnique_(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, { nama: val1, no_hp: '0844' }, actor, ctx.headersMap);
  assert_(r3.success && r3.isUpdate === true, 'upsertUnique tanpa PK inject.');

  // 8. findUnique value kosong → null (tidak throw)
  assert_(findUnique_(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, '', ctx.headersMap) === null, 'findUnique empty null.');

  // 9. Wrapper publik
  assert_(findUnique(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, val1, ctx.headersMap) !== null, 'public findUnique.');
  var val3 = 'UNIQ-' + Date.now() + '-C';
  var r4 = upsertUnique(ctx.ssId, 'ZZ_TEST_CRUD', uniqField, { id: 'UQ-4', nama: val3 }, actor, ctx.headersMap);
  assert_(r4.success, 'public upsertUnique.');

  // Cleanup
  wipeSheet_(sh);
  invalidateSheetCache('ZZ_TEST_CRUD', ctx.ssId);
}

// ==================== RUNNER & HELPERS ====================

function testAll() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID') || '';
  var masterSsId = props.getProperty('MASTER_SPREADSHEET_ID') || ssId;
  var platformUrl = props.getProperty('PLATFORM_API_URL') || '';
  var ssIdB = props.getProperty('TEST_SPREADSHEET_ID_B') || '';

  Logger.log('Test SSID: ' + ssId);
  Logger.log('Test SSID-B: ' + (ssIdB || '(kosong — testCacheIsolation akan SKIP)'));

  if (!ssId) {
    Logger.log('❌ SPREADSHEET_ID kosong di Script Properties CoreLib.');
    return;
  }

  var headersMap = {
    ZZ_TEST_CRUD: ['id', 'nama', 'no_hp', 'catatan_baru', 'laporan_id']
  };

  // PRE-SETUP: pastikan sheet ZZ_TEST_CRUD ada sebelum test
  try {
    Logger.log('Pre-setup: memastikan sheet test ada...');
    ensureSheet(ssId, 'ZZ_TEST_CRUD', headersMap, {});
    var ss = SpreadsheetApp.openById(ssId);
    var sh = ss.getSheetByName('ZZ_TEST_CRUD');
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var colNoHp = headers.indexOf('no_hp') + 1;
    if (colNoHp > 0) {
      sh.getRange(2, colNoHp, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    }
    Logger.log('✅ Pre-setup selesai.');
  } catch (e) {
    Logger.log('[WARN] Pre-setup: ' + e.message);
  }

  var ctx = {
    ssId: ssId,
    ssIdB: ssIdB,
    masterSsId: masterSsId,
    headersMap: headersMap,
    platformApiUrl: platformUrl,
    appCode: 'CORELIB_TEST'
  };

  var result = runCoreTests(ctx);
  Logger.log('');
  Logger.log('=== RINGKASAN ===');
  Logger.log('PASS: ' + result.passed + ' / FAIL: ' + result.failed + ' / SKIP: ' + result.skipped);
  result.results.forEach(function(r) {
    Logger.log('[' + r.status + '] ' + r.test + (r.detail ? ' — ' + r.detail : ''));
  });
}

// Quick check bahwa library v2.3.0 aktif.
function cekUpdateCorelib() {
  try {
    var testRole = CoreLib.getHighestRole(['kasat']);
    Logger.log('✅ CoreLib aktif. getHighestRole(["kasat"]) = ' + testRole);
  } catch (e) {
    Logger.log('❌ CoreLib error: ' + e.message);
  }

  try {
    Logger.log('✅ normId_ tersedia: ' + (typeof normId_ === 'function'));
    Logger.log('✅ parseDate_ tersedia: ' + (typeof parseDate_ === 'function'));
    Logger.log('✅ requireRole_ tersedia: ' + (typeof requireRole_ === 'function'));
    Logger.log('✅ isAllowedConfigKey_ tersedia: ' + (typeof isAllowedConfigKey_ === 'function'));
    // v2.3.0 baru
    Logger.log('✅ todayIsoLocal_ tersedia: ' + (typeof todayIsoLocal_ === 'function'));
    Logger.log('✅ dateKey10_ tersedia: ' + (typeof dateKey10_ === 'function'));
    Logger.log('✅ paginate_ tersedia: ' + (typeof paginate_ === 'function'));
    Logger.log('✅ matchSearch_ tersedia: ' + (typeof matchSearch_ === 'function'));
  } catch (e) {
    Logger.log('❌ Fungsi v2.3.0 tidak lengkap: ' + e.message);
  }

  // Cek fix genUniqueCode (v2.2.1)
  try {
    var fnStr = genUniqueCode_.toString();
    var hasBuggy = fnStr.indexOf('reAnyNumber') !== -1;
    Logger.log(hasBuggy ? '❌ genUniqueCode_ masih versi LAMA (buggy)' : '✅ genUniqueCode_ versi v2.2.1 (fix)');
  } catch (e) {
    Logger.log('⚠️ Cek genUniqueCode_: ' + e.message);
  }

  var props = PropertiesService.getScriptProperties();
  Logger.log('SPREADSHEET_ID        = ' + props.getProperty('SPREADSHEET_ID'));
  Logger.log('MASTER_SPREADSHEET_ID = ' + props.getProperty('MASTER_SPREADSHEET_ID'));
  Logger.log('TEST_SPREADSHEET_ID_B = ' + (props.getProperty('TEST_SPREADSHEET_ID_B') || '(belum di-set)'));

  var ssId = props.getProperty('SPREADSHEET_ID');
  if (ssId) {
    try {
      var ss = SpreadsheetApp.openById(ssId);
      Logger.log('Spreadsheet: ' + ss.getName());
    } catch (e) {
      Logger.log('❌ Gagal buka: ' + e.message);
    }
  }
}
