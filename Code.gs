/**
 * BACKEND DASHBOARD ASET EKS BPPN - KPKNL DENPASAR
 * ---------------------------------------------------
 * SETUP SPREADSHEET (4 tab/sheet dibutuhkan):
 *
 * 1) Tab "Aset" (data aset)
 *    Header baris pertama, urutan bebas asal nama sama:
 *      id | kode_aset | asal_aset | lokasi | status | kategori_penitipan | keterangan_kategori | luas_tanah | luas_bangunan | no_dokumen | jenis_dokumen | catatan | link_folder | geom_type | geometry_json
 *    Kolom "id", "geom_type", "geometry_json" WAJIB ada (dipakai sistem).
 *
 * 2) Tab "Riwayat" (riwayat dokumen per aset)
 *    Header baris pertama: id | asset_id | no_dokumen | jenis_dokumen | tanggal | catatan
 *
 * 3) Tab "Foto" (foto & geotagging per aset - dibuat otomatis jika belum ada)
 *    Header baris pertama: id | asset_id | url_foto | lat | lng | sumber_tag | tanggal
 *
 * 4) Tab "Users" (untuk login & role)
 *    Header baris pertama: username | password | role | nama | aktif
 *
 * 5) Tab "LogEkspor" -- TIDAK PERLU DIBUAT MANUAL. Otomatis dibuat sistem
 */

const SHEET_ASET = "Aset";
const SHEET_RIWAYAT = "Riwayat";
const SHEET_FOTO = "Foto";
const SHEET_USERS = "Users";
const SHEET_LOG = "LogEkspor";
const RESERVED_COLUMNS = ["id", "geom_type", "geometry_json"];
const SESSION_TTL_SECONDS = 21600; // 6 jam

function getSheet_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}
function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================= MENU =================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Aset eks BPPN')
    .addItem('Generate Password Hash...', 'promptPasswordHash_')
    .addToUi();
}

function promptPasswordHash_() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt('Generate Password Hash', 'Masukkan password baru (plain text):', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() == ui.Button.OK) {
    const plain = result.getResponseText();
    if (!plain) { ui.alert('Password tidak boleh kosong.'); return; }
    const hash = hashPassword_(plain);
    ui.alert('Hash untuk password tersebut:\n\n' + hash + '\n\nSalin nilai ini ke kolom "password" di tab Users.');
  }
}

function onEdit(e) {
  try {
    const sheet = e.range.getSheet();
    if (sheet.getName() !== SHEET_USERS) return;
    if (e.range.getRow() === 1) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const passwordCol = headers.indexOf('password') + 1;
    if (passwordCol === 0 || e.range.getColumn() !== passwordCol) return;

    const value = e.range.getValue();
    if (!value) return;
    if (/^[a-f0-9]{64}$/i.test(String(value))) return;

    e.range.setValue(hashPassword_(String(value)));
  } catch (err) {}
}

// ================= AUTH HELPERS =================
function hashPassword_(plain) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plain, Utilities.Charset.UTF_8);
  return digest.map(function (b) {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function createSession_(username, role, nama) {
  const cleanUser = String(username || 'user').replace(/[^a-zA-Z0-9]/g, '');
  const cleanRole = String(role || 'viewer').toLowerCase();
  const token = cleanUser + '_' + cleanRole + '_' + Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  try {
    cache.put('session_' + token, JSON.stringify({ username: username, role: role, nama: nama }), SESSION_TTL_SECONDS);
  } catch (e) {}
  return token;
}

function getSession_(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  try {
    const raw = cache.get('session_' + token);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  // Fallback jika cache terhapus karena Apps Script di-deploy ulang oleh Google
  if (typeof token === 'string' && token.indexOf('_') !== -1) {
    const parts = token.split('_');
    if (parts.length >= 3) {
      const username = parts[0];
      const role = parts[1];
      if (username && (role === 'admin' || role === 'viewer')) {
        const fallbackSession = { username: username, role: role, nama: username };
        try { cache.put('session_' + token, JSON.stringify(fallbackSession), SESSION_TTL_SECONDS); } catch(e) {}
        return fallbackSession;
      }
    }
  }
  return null;
}

function requireSession_(token) {
  const session = getSession_(token);
  if (!session) throw new Error('Sesi tidak valid atau sudah kedaluwarsa. Silakan login ulang.');
  return session;
}

function requireAdmin_(token) {
  const session = requireSession_(token);
  if (String(session.role || '').toLowerCase() !== 'admin') throw new Error('Akses ditolak. Hanya admin yang bisa melakukan perubahan.');
  return session;
}

function login_(username, password) {
  if (!username || !password) throw new Error('Username dan password wajib diisi.');
  const sheet = getSheet_(SHEET_USERS);
  if (!sheet) throw new Error("Sheet '" + SHEET_USERS + "' tidak ditemukan. Buat dulu sesuai petunjuk.");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxUser = headers.indexOf('username');
  const idxPass = headers.indexOf('password');
  const idxRole = headers.indexOf('role');
  const idxNama = headers.indexOf('nama');
  const idxAktif = headers.indexOf('aktif');
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idxUser]).toLowerCase() === String(username).toLowerCase()) {
      const aktif = idxAktif === -1 ? true : (row[idxAktif] === true || String(row[idxAktif]).toUpperCase() === 'TRUE');
      if (!aktif) throw new Error('Akun tidak aktif. Hubungi admin.');
      const storedHash = row[idxPass];
      const inputHash = hashPassword_(password);
      if (String(storedHash) === String(inputHash)) {
        const role = idxRole === -1 ? 'viewer' : row[idxRole];
        const nama = idxNama === -1 ? username : (row[idxNama] || username);
        const token = createSession_(username, role, nama);
        return { username: username, role: role, nama: nama, token: token };
      }
      throw new Error('Username atau password salah.');
    }
  }
  throw new Error('Username atau password salah.');
}

// ================= GET =================
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'getAset';

    // TEMPORARY DEBUG: inspect sheet headers & first 3 rows without auth
    if (action === 'debugHeaders') {
      const sheet = getSheet_(SHEET_ASET);
      if (!sheet) return jsonResponse_({ ok: false, error: 'Sheet not found' });
      const data = sheet.getDataRange().getValues();
      const headers = data[0] || [];
      const row1 = data[1] || [];
      const row2 = data[2] || [];
      const sample = {};
      headers.forEach(function(h, i) { sample[h + ' [col' + (i+1) + ']'] = row1[i]; });
      const sample2 = {};
      headers.forEach(function(h, i) { sample2[h + ' [col' + (i+1) + ']'] = row2[i]; });
      return jsonResponse_({
        ok: true,
        totalRows: data.length - 1,
        headers: headers,
        row2_data: sample,
        row3_data: sample2
      });
    }

    // TEMPORARY DEBUG: directly write a test kluster value to row 2 without auth
    if (action === 'testWrite') {
      const sheet = getSheet_(SHEET_ASET);
      if (!sheet) return jsonResponse_({ ok: false, error: 'Sheet not found' });
      const data = sheet.getDataRange().getValues();
      const headers = data[0] || [];
      const klusterColIdx = headers.indexOf('kluster');
      if (klusterColIdx === -1) return jsonResponse_({ ok: false, error: 'kluster column not found', headers: headers });
      const testValue = (params.value || 'DEBUG_TEST_OK');
      // Write to row 2 (index 1 = first data row), the kluster column
      sheet.getRange(2, klusterColIdx + 1).setValue(testValue);
      // Read back
      const written = sheet.getRange(2, klusterColIdx + 1).getValue();
      return jsonResponse_({
        ok: true,
        klusterColIdx: klusterColIdx,
        klusterColLetter: String.fromCharCode(65 + klusterColIdx),
        writtenValue: written,
        row2Id: String(data[1][headers.indexOf('id')] || data[1][0])
      });
    }

    // TEMPORARY DEBUG: run full upsertAsset_ with a test kluster value, no auth
    if (action === 'testUpsert') {
      const sheet = getSheet_(SHEET_ASET);
      if (!sheet) return jsonResponse_({ ok: false, error: 'Sheet not found' });
      const data = sheet.getDataRange().getValues();
      const headers = data[0] || [];
      const klusterColIdx = headers.indexOf('kluster');
      const idColIdx = headers.indexOf('id');
      if (idColIdx === -1) return jsonResponse_({ ok: false, error: 'id column not found' });
      // Read first data row and build a mock asset from it
      const row = data[1] || [];
      const mockProps = {};
      headers.forEach(function(h, i) {
        if (['id','geom_type','geometry_json'].indexOf(h) === -1) mockProps[h] = row[i];
      });
      mockProps.kluster = params.value || 'UPSERT_TEST_XYZ';
      let geom = null;
      try { geom = JSON.parse(row[headers.indexOf('geometry_json')] || 'null'); } catch(e) {}
      const mockAsset = {
        id: String(row[idColIdx]),
        geomType: row[headers.indexOf('geom_type')] || 'point',
        geometry: geom,
        props: mockProps
      };
      const result = upsertAsset_(mockAsset);
      // Read back
      const writtenKluster = sheet.getRange(2, klusterColIdx + 1).getValue();
      return jsonResponse_({
        ok: true,
        upsertResult: result,
        mockAssetId: mockAsset.id,
        klusterSentValue: mockProps.kluster,
        klusterWrittenToSheet: writtenKluster,
        success: writtenKluster === mockProps.kluster
      });
    }

    // TEMPORARY DEBUG: read ALL rows kluster + id values without auth
    if (action === 'readAll') {
      const sheet = getSheet_(SHEET_ASET);
      if (!sheet) return jsonResponse_({ ok: false, error: 'Sheet not found' });
      const data = sheet.getDataRange().getValues();
      const headers = data[0] || [];
      const klusterColIdx = headers.indexOf('kluster');
      const idColIdx = headers.indexOf('id');
      const kodeColIdx = headers.indexOf('kode_aset');
      const rows = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row.some(function(c){ return c !== ''; })) {
          rows.push({
            sheetRow: i + 1,
            id: String(row[idColIdx] || ''),
            kode_aset: String(row[kodeColIdx] || ''),
            kluster: String(row[klusterColIdx] || '')
          });
        }
      }
      return jsonResponse_({ ok: true, totalRows: rows.length, klusterColLetter: String.fromCharCode(65+klusterColIdx), rows: rows });
    }

    if (action === 'getAset') {


      requireSession_(params.token);
      return jsonResponse_(getAsetData_());
    }

    if (action === 'getHistory') {
      requireSession_(params.token);
      if (!params.asset_id) return jsonResponse_({ ok: false, error: 'asset_id wajib diisi' });
      return jsonResponse_({ ok: true, history: getHistoryData_(params.asset_id) });
    }

    if (action === 'getPhotos') {
      requireSession_(params.token);
      if (!params.asset_id) return jsonResponse_({ ok: false, error: 'asset_id wajib diisi' });
      return jsonResponse_({ ok: true, photos: getPhotosData_(params.asset_id) });
    }

    return jsonResponse_({ ok: false, error: 'Aksi tidak dikenali: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err.message || err) });
  }
}

function normalizeKey_(key) {
  const s = String(key || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (s === 'asal' || s === 'asal_asset' || s === 'asal_aset_bppn_ppa') return 'asal_aset';
  if (s === 'luas_tanah_m2' || s === 'luas_tanah_(m2)') return 'luas_tanah';
  if (s === 'luas_bangunan_m2' || s === 'luas_bangunan_(m2)') return 'luas_bangunan';
  if (s === 'kluster_aset' || s === 'kluster' || s === 'cluster' || s === 'cluster_aset') return 'kluster';
  if (s === 'kategori' || s === 'kategori_penitipan' || s === 'status_penitipan') return 'kategori_penitipan';
  return s;
}

function getAsetData_() {
  const sheet = getSheet_(SHEET_ASET);
  if (!sheet) return { ok: false, error: "Sheet '" + SHEET_ASET + "' tidak ditemukan" };
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, headers: data[0] || [], features: [] };
  const headers = data[0];
  const rows = data.slice(1);
  const features = rows
    .filter(function (row) {
      return row.some(function(cell) { return cell !== '' && cell !== null && cell !== undefined; });
    })
    .map(function (row, idx) {
      const obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      let assetId = (obj.id !== undefined && obj.id !== null && String(obj.id).trim() !== '') 
        ? String(obj.id) 
        : ('A_ROW_' + (idx + 1));
      let geometry = null;
      try { geometry = JSON.parse(obj.geometry_json || 'null'); } catch (err) { geometry = null; }
      const props = {};
      headers.forEach(function (h) {
        if (RESERVED_COLUMNS.indexOf(h) === -1) {
          props[h] = obj[h];
          const norm = normalizeKey_(h);
          if (norm && norm !== h) props[norm] = obj[h];
        }
      });
      return {
        id: assetId,
        geomType: obj.geom_type || 'point',
        geometry: geometry,
        props: props
      };
    });
  return { ok: true, headers: headers, features: features };
}

function getHistoryData_(assetId) {
  const sheet = getSheet_(SHEET_RIWAYAT);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const idxId = headers.indexOf('id');
  const idxAsset = headers.indexOf('asset_id');
  const idxNoDok = headers.indexOf('no_dokumen');
  const idxJenis = headers.indexOf('jenis_dokumen');
  const idxTanggal = headers.indexOf('tanggal');
  const idxCatatan = headers.indexOf('catatan');
  const rows = data.slice(1);
  const entries = rows
    .filter(function (row) { return String(row[idxAsset]) === String(assetId); })
    .map(function (row) {
      return {
        id: String(row[idxId]),
        asset_id: String(row[idxAsset]),
        no_dokumen: row[idxNoDok] || '',
        jenis_dokumen: idxJenis !== -1 ? (row[idxJenis] || '') : '',
        tanggal: row[idxTanggal] ? formatDate_(row[idxTanggal]) : '',
        catatan: idxCatatan !== -1 ? (row[idxCatatan] || '') : ''
      };
    });
  entries.sort(function (a, b) { return new Date(a.tanggal) - new Date(b.tanggal); });
  return entries;
}

function getPhotosData_(assetId) {
  let sheet = getSheet_(SHEET_FOTO);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const idxId = headers.indexOf('id');
  const idxAsset = headers.indexOf('asset_id');
  const idxUrl = headers.indexOf('url_foto');
  const idxLat = headers.indexOf('lat');
  const idxLng = headers.indexOf('lng');
  const idxSumber = headers.indexOf('sumber_tag');
  const idxTanggal = headers.indexOf('tanggal');
  const rows = data.slice(1);
  return rows
    .filter(function (row) { return String(row[idxAsset]) === String(assetId); })
    .map(function (row) {
      return {
        id: String(row[idxId]),
        asset_id: String(row[idxAsset]),
        url_foto: row[idxUrl] || '',
        lat: idxLat !== -1 ? row[idxLat] : '',
        lng: idxLng !== -1 ? row[idxLng] : '',
        sumber_tag: idxSumber !== -1 ? (row[idxSumber] || '') : '',
        tanggal: idxTanggal !== -1 ? (row[idxTanggal] ? formatDate_(row[idxTanggal]) : '') : ''
      };
    });
}

function formatDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value);
}

// ================= POST =================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'login') {
      const result = login_(body.username, body.password);
      return jsonResponse_(Object.assign({ ok: true }, result));
    }

    if (action === 'create' || action === 'update') {
      requireAdmin_(body.token);
      return jsonResponse_(upsertAsset_(body.asset));
    }

    if (action === 'delete') {
      requireAdmin_(body.token);
      return jsonResponse_(deleteAsset_(body.id));
    }

    if (action === 'addHistory') {
      requireAdmin_(body.token);
      return jsonResponse_(addHistoryEntry_(body.entry));
    }

    if (action === 'deleteHistory') {
      requireAdmin_(body.token);
      return jsonResponse_(deleteHistoryEntry_(body.id));
    }

    if (action === 'addPhoto') {
      requireAdmin_(body.token);
      return jsonResponse_(addPhotoEntry_(body.entry));
    }

    if (action === 'addPhotoBatch') {
      requireAdmin_(body.token);
      return jsonResponse_(addPhotoBatchEntries_(body.entries));
    }

    if (action === 'deletePhoto') {
      requireAdmin_(body.token);
      return jsonResponse_(deletePhotoEntry_(body.id));
    }

    if (action === 'exportData') {
      const session = requireAdmin_(body.token);
      return jsonResponse_(exportData_(session.username));
    }

    return jsonResponse_({ ok: false, error: 'Aksi tidak dikenali: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err.message || err) });
  }
}

function upsertAsset_(asset) {
  const sheet = getSheet_(SHEET_ASET);
  if (!sheet) return { ok: false, error: "Sheet '" + SHEET_ASET + "' tidak ditemukan" };
  let data = sheet.getDataRange().getValues();
  let headers = data[0] || [];

  if (asset.props) {
    let headerModified = false;
    const existingNorms = headers.map(function(h) { return normalizeKey_(h); });
    Object.keys(asset.props).forEach(function(key) {
      if (RESERVED_COLUMNS.indexOf(key) === -1) {
        const normKey = normalizeKey_(key);
        if (existingNorms.indexOf(normKey) === -1 && headers.indexOf(key) === -1) {
          headers.push(key);
          existingNorms.push(normKey);
          headerModified = true;
        }
      }
    });
    if (headerModified) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      data = sheet.getDataRange().getValues();
    }
  }

  const idxId = headers.indexOf('id');
  const idxKode = headers.map(function(h){ return normalizeKey_(h); }).indexOf('kode_aset');

  function findRowIndexById(id) {
    // 1. Cek berdasarkan kolom 'id' jika ada
    if (idxId !== -1) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idxId]).trim() === String(id).trim()) return i + 1;
      }
    }
    // 2. Cek berdasarkan kode_aset jika asset.props.kode_aset ada
    if (asset.props && asset.props.kode_aset && idxKode !== -1) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idxKode]).trim() === String(asset.props.kode_aset).trim()) return i + 1;
      }
    }
    // 3. Cek jika ID berformat 'A_ROW_X'
    if (String(id).indexOf('A_ROW_') === 0) {
      const rowNum = parseInt(String(id).replace('A_ROW_', ''), 10);
      if (!isNaN(rowNum) && rowNum >= 1 && rowNum < data.length) {
        return rowNum + 1;
      }
    }
    // 4. Default: cek kolom pertama (0)
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(id).trim()) return i + 1;
    }
    return -1;
  }
  const rowValues = headers.map(function (h) {
    if (h === 'id') return asset.id;
    if (h === 'geom_type') return asset.geomType;
    if (h === 'geometry_json') return JSON.stringify(asset.geometry);
    if (!asset.props) return '';
    const norm = normalizeKey_(h);
    // Check normalized key first (handles header aliases like 'cluster' → 'kluster')
    var normVal = asset.props[norm];
    if (normVal !== undefined && String(normVal).trim() !== '') return normVal;
    // Then check the exact header name
    var rawVal = asset.props[h];
    if (rawVal !== undefined && rawVal !== null) return rawVal;
    // Fall back to norm even if empty
    if (normVal !== undefined) return normVal;
    return '';
  });
  const rowIndex = findRowIndexById(asset.id);
  if (rowIndex === -1) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
  }
  return { ok: true, headers: headers };
}

function deleteAsset_(id) {
  const sheet = getSheet_(SHEET_ASET);
  if (!sheet) return { ok: false, error: "Sheet '" + SHEET_ASET + "' tidak ditemukan" };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return { ok: true };
}

function addHistoryEntry_(entry) {
  const sheet = getSheet_(SHEET_RIWAYAT);
  if (!sheet) return { ok: false, error: "Sheet '" + SHEET_RIWAYAT + "' tidak ditemukan." };
  if (!entry || !entry.asset_id) return { ok: false, error: 'asset_id wajib diisi' };
  const headers = sheet.getDataRange().getValues()[0];
  const id = 'H' + new Date().getTime() + Math.floor(Math.random() * 1000);
  const rowValues = headers.map(function (h) {
    if (h === 'id') return id;
    if (h === 'asset_id') return entry.asset_id;
    if (h === 'no_dokumen') return entry.no_dokumen || '';
    if (h === 'jenis_dokumen') return entry.jenis_dokumen || '';
    if (h === 'tanggal') return entry.tanggal || '';
    if (h === 'catatan') return entry.catatan || '';
    return '';
  });
  sheet.appendRow(rowValues);
  return { ok: true, id: id };
}

function deleteHistoryEntry_(id) {
  const sheet = getSheet_(SHEET_RIWAYAT);
  if (!sheet) return { ok: false, error: "Sheet '" + SHEET_RIWAYAT + "' tidak ditemukan" };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxId = headers.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return { ok: true };
}

function addPhotoEntry_(entry) {
  let sheet = getSheet_(SHEET_FOTO);
  if (!sheet) {
    const activeSs = SpreadsheetApp.getActiveSpreadsheet();
    sheet = activeSs.insertSheet(SHEET_FOTO);
    sheet.appendRow(['id', 'asset_id', 'url_foto', 'lat', 'lng', 'sumber_tag', 'tanggal']);
  }
  if (!entry || !entry.asset_id) return { ok: false, error: 'asset_id wajib diisi' };

  let photoUrl = entry.url_foto || '';
  if (entry.base64) {
    try {
      const folderName = "Foto_Aset_BPPN_Demo";
      let folder;
      const folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
      const rawBase64 = entry.base64.replace(/^data:image\/\w+;base64,/, '');
      const fileData = Utilities.base64Decode(rawBase64);
      const blob = Utilities.newBlob(fileData, entry.mimeType || 'image/jpeg', 'foto_' + entry.asset_id + '_' + Date.now() + '.jpg');
      const file = folder.createFile(blob);
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        Logger.log("setSharing Warning: " + shareErr.toString());
      }
      photoUrl = "https://lh3.googleusercontent.com/d/" + file.getId();
    } catch (e) {
      Logger.log("DriveApp Error: " + e.toString());
      return { 
        ok: false, 
        error: "Google Drive Error: Izin Google Drive belum diberikan pada Apps Script atau Web App belum di-deploy sebagai Versi Baru. Detail: " + e.toString() 
      };
    }
  }

  const headers = sheet.getDataRange().getValues()[0];
  const id = 'F' + new Date().getTime() + Math.floor(Math.random() * 1000);
  const tanggal = formatDate_(new Date());
  const rowValues = headers.map(function (h) {
    if (h === 'id') return id;
    if (h === 'asset_id') return entry.asset_id;
    if (h === 'url_foto') return photoUrl;
    if (h === 'lat') return entry.lat !== undefined ? entry.lat : '';
    if (h === 'lng') return entry.lng !== undefined ? entry.lng : '';
    if (h === 'sumber_tag') return entry.sumber_tag || '';
    if (h === 'tanggal') return tanggal;
    return '';
  });
  sheet.appendRow(rowValues);
  return { ok: true, id: id, url_foto: photoUrl };
}

function addPhotoBatchEntries_(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return { ok: false, error: 'Tidak ada data foto yang dikirim' };
  }
  const results = [];
  for (let i = 0; i < entries.length; i++) {
    const res = addPhotoEntry_(entries[i]);
    results.push(res);
  }
  return { ok: true, results: results };
}

function deletePhotoEntry_(id) {
  const sheet = getSheet_(SHEET_FOTO);
  if (!sheet) return { ok: false, error: "Sheet '" + SHEET_FOTO + "' tidak ditemukan" };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxId = headers.indexOf('id');
  const idxUrl = headers.indexOf('url_foto');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === String(id)) {
      const photoUrl = data[i][idxUrl];
      sheet.deleteRow(i + 1);
      if (photoUrl && photoUrl.includes('googleusercontent.com/d/')) {
        try {
          const fileId = photoUrl.split('googleusercontent.com/d/')[1];
          if (fileId) DriveApp.getFileById(fileId).setTrashed(true);
        } catch (e) {}
      }
      break;
    }
  }
  return { ok: true };
}

function generatePasswordHash() {
  const PLAIN_PASSWORD = 'GANTI_INI';
  Logger.log(hashPassword_(PLAIN_PASSWORD));
}

function exportData_(username) {
  const asetSheet = getSheet_(SHEET_ASET);
  const riwayatSheet = getSheet_(SHEET_RIWAYAT);
  if (!asetSheet) return { ok: false, error: "Sheet '" + SHEET_ASET + "' tidak ditemukan" };

  const asetData = asetSheet.getDataRange().getValues();
  const riwayatData = riwayatSheet ? riwayatSheet.getDataRange().getValues() : [['id', 'asset_id', 'no_dokumen', 'jenis_dokumen', 'tanggal', 'catatan']];

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH-mm');
  const tempSs = SpreadsheetApp.create('TEMP_export_' + timestamp);
  const tempId = tempSs.getId();

  const asetSheetNew = tempSs.getSheets()[0];
  asetSheetNew.setName('Aset');
  if (asetData.length) asetSheetNew.getRange(1, 1, asetData.length, asetData[0].length).setValues(asetData);

  const riwayatSheetNew = tempSs.insertSheet('Riwayat');
  if (riwayatData.length) riwayatSheetNew.getRange(1, 1, riwayatData.length, riwayatData[0].length).setValues(riwayatData);

  SpreadsheetApp.flush();

  const exportUrl = 'https://docs.google.com/spreadsheets/d/' + tempId + '/export?format=xlsx';
  const response = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  const base64 = Utilities.base64Encode(response.getBlob().getBytes());

  try {
    DriveApp.getFileById(tempId).setTrashed(true);
  } catch (cleanupErr) {}

  const jumlahAset = Math.max(0, asetData.length - 1);
  const jumlahRiwayat = Math.max(0, riwayatData.length - 1);
  const filename = 'ekspor-aset-eks-bppn-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm') + '.xlsx';
  logExport_(username, filename, jumlahAset, jumlahRiwayat);

  return { ok: true, filename: filename, base64: base64, jumlahAset: jumlahAset, jumlahRiwayat: jumlahRiwayat };
}

function logExport_(username, filename, jumlahAset, jumlahRiwayat) {
  let sheet = getSheet_(SHEET_LOG);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_LOG);
    sheet.appendRow(['timestamp', 'username', 'nama_file', 'jumlah_aset', 'jumlah_riwayat']);
  }
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  sheet.appendRow([timestamp, username, filename, jumlahAset, jumlahRiwayat]);
}
