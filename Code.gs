/**
 * BACKEND DASHBOARD ASET EKS BPPN - KPKNL DENPASAR
 * ---------------------------------------------------
 * SETUP SPREADSHEET (3 tab/sheet dibutuhkan):
 *
 * 1) Tab "Aset" (data aset, sama seperti sebelumnya)
 *    Header baris pertama, urutan bebas asal nama sama:
 *      id | kode_aset | lokasi | status | luas | no_dokumen | jenis_dokumen | catatan | geom_type | geometry_json
 *    Kolom "id", "geom_type", "geometry_json" WAJIB ada (dipakai sistem).
 *    Kolom lain boleh kamu tambah/hapus/ubah nama bebas -- otomatis muncul di dashboard.
 *
 * 2) Tab "Riwayat" (BARU - riwayat dokumen per aset)
 *    Header baris pertama, PERSIS:
 *      id | asset_id | no_dokumen | jenis_dokumen | tanggal | catatan
 *    - id           : diisi otomatis oleh sistem saat entri baru ditambah
 *    - asset_id     : harus cocok dengan kolom "id" di tab Aset
 *    - tanggal      : isi format tanggal (boleh ketik manual "2024-03-15" atau pilih dari date picker di dashboard)
 *
 * 3) Tab "Users" (BARU - untuk login & role)
 *    Header baris pertama, PERSIS:
 *      username | password | role | nama | aktif
 *    - password : boleh diisi lewat menu "Aset eks BPPN" > "Generate Password
 *                 Hash..." (disarankan), ATAU ketik langsung password aslinya
 *                 ke sel -- begitu Enter, sistem OTOMATIS menggantinya dengan
 *                 hash SHA-256 (lihat fungsi onEdit di bawah). Jadi plain text
 *                 tidak akan pernah tersimpan permanen, walau langkah manual
 *                 di menu terlewat.
 *    - role     : isi "admin" (bisa tambah/edit/hapus) atau "viewer" (lihat saja)
 *    - aktif    : isi TRUE atau FALSE. Set FALSE untuk menonaktifkan user tanpa
 *                 menghapus barisnya (jejak tetap ada).
 *
 * DEPLOY:
 * Deploy > New deployment > Web app
 *   - Execute as: Me
 *   - Who has access: Anyone (atau "Anyone within [organisasi]" untuk domain kantor)
 * Salin URL Web App ke API_URL di config.js dashboard.
 *
 * CATATAN KEAMANAN:
 * Ini pakai Google Sheets sebagai "database", jadi bukan sistem auth kelas
 * enterprise. Password disimpan sebagai hash SHA-256 (bukan plain text), dan
 * setiap aksi tulis (create/update/delete/riwayat) divalidasi ulang di server
 * ini berdasarkan role, bukan cuma disembunyikan di tampilan. Untuk penggunaan
 * internal tim kecil ini cukup aman; kalau datanya makin sensitif, pertimbangkan
 * migrasi ke backend yang lebih matang.
 */

const SHEET_ASET = "Aset";
const SHEET_RIWAYAT = "Riwayat";
const SHEET_USERS = "Users";
const RESERVED_COLUMNS = ["id", "geom_type", "geometry_json"];
const SESSION_TTL_SECONDS = 21600; // 6 jam - batas maksimum CacheService

function getSheet_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}
function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================= MENU (tampil di Google Sheets) =================
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
    ui.alert('Hash untuk password tersebut:\n\n' + hash + '\n\nSalin nilai ini ke kolom "password" di tab Users (bukan password aslinya).');
  }
}

// Jaring pengaman: kalau seseorang mengetik/menempel password APA ADANYA
// (plain text) langsung ke sel kolom "password" di tab Users -- tanpa lewat
// menu di atas -- trigger ini otomatis menggantinya dengan hash SHA-256 saat
// itu juga. Jadi plain text tidak pernah tersimpan permanen di sheet, bahkan
// kalau langkah manual di atas terlewat.
function onEdit(e) {
  try {
    const sheet = e.range.getSheet();
    if (sheet.getName() !== SHEET_USERS) return;
    if (e.range.getRow() === 1) return; // header, abaikan

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const passwordCol = headers.indexOf('password') + 1; // 1-indexed, 0 kalau tidak ketemu
    if (passwordCol === 0 || e.range.getColumn() !== passwordCol) return;

    const value = e.range.getValue();
    if (!value) return;

    // Kalau nilainya sudah terlihat seperti hash SHA-256 (64 karakter hex),
    // anggap sudah di-hash sebelumnya -- jangan di-hash dobel.
    if (/^[a-f0-9]{64}$/i.test(String(value))) return;

    e.range.setValue(hashPassword_(String(value)));
  } catch (err) {
    // Sengaja tidak dilempar ke atas supaya tidak mengganggu proses edit sheet.
  }
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
  const token = Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  cache.put('session_' + token, JSON.stringify({ username: username, role: role, nama: nama }), SESSION_TTL_SECONDS);
  return token;
}

function getSession_(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const raw = cache.get('session_' + token);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function requireSession_(token) {
  const session = getSession_(token);
  if (!session) throw new Error('Sesi tidak valid atau sudah kedaluwarsa. Silakan login ulang.');
  return session;
}

function requireAdmin_(token) {
  const session = requireSession_(token);
  if (session.role !== 'admin') throw new Error('Akses ditolak. Hanya admin yang bisa melakukan perubahan.');
  return session;
}

function login_(username, password) {
  if (!username || !password) throw new Error('Username dan password wajib diisi.');
  const sheet = getSheet_(SHEET_USERS);
  if (!sheet) throw new Error("Sheet '" + SHEET_USERS + "' tidak ditemukan. Buat dulu sesuai petunjuk di atas kode.");
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

// ================= GET: baca data =================
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'getAset';

    if (action === 'getAset') {
      requireSession_(params.token);
      return jsonResponse_(getAsetData_());
    }

    if (action === 'getHistory') {
      requireSession_(params.token);
      if (!params.asset_id) return jsonResponse_({ ok: false, error: 'asset_id wajib diisi' });
      return jsonResponse_({ ok: true, history: getHistoryData_(params.asset_id) });
    }

    return jsonResponse_({ ok: false, error: 'Aksi tidak dikenali: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err.message || err) });
  }
}

function getAsetData_() {
  const sheet = getSheet_(SHEET_ASET);
  if (!sheet) return { ok: false, error: "Sheet '" + SHEET_ASET + "' tidak ditemukan" };
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, headers: data[0] || [], features: [] };
  const headers = data[0];
  const rows = data.slice(1);
  const features = rows
    .filter(function (row) { return row[0] !== '' && row[0] !== null; })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      let geometry = null;
      try { geometry = JSON.parse(obj.geometry_json || 'null'); } catch (err) { geometry = null; }
      const props = {};
      headers.forEach(function (h) {
        if (RESERVED_COLUMNS.indexOf(h) === -1) props[h] = obj[h];
      });
      return {
        id: String(obj.id),
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
  // urutkan kronologis: tanggal paling lama duluan
  entries.sort(function (a, b) { return new Date(a.tanggal) - new Date(b.tanggal); });
  return entries;
}

function formatDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value);
}

// ================= POST: create / update / delete / login / riwayat =================
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

    return jsonResponse_({ ok: false, error: 'Aksi tidak dikenali: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err.message || err) });
  }
}

function upsertAsset_(asset) {
  const sheet = getSheet_(SHEET_ASET);
  if (!sheet) return { ok: false, error: "Sheet '" + SHEET_ASET + "' tidak ditemukan" };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  function findRowIndexById(id) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) return i + 1; // 1-indexed row di sheet
    }
    return -1;
  }
  const rowValues = headers.map(function (h) {
    if (h === 'id') return asset.id;
    if (h === 'geom_type') return asset.geomType;
    if (h === 'geometry_json') return JSON.stringify(asset.geometry);
    return (asset.props && asset.props[h] !== undefined) ? asset.props[h] : '';
  });
  const rowIndex = findRowIndexById(asset.id);
  if (rowIndex === -1) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
  }
  return { ok: true };
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
  if (!sheet) return { ok: false, error: "Sheet '" + SHEET_RIWAYAT + "' tidak ditemukan. Buat dulu sesuai petunjuk di atas kode." };
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

// ================= UTILITY: generate hash password dari editor =================
// Cara pakai (kalau menu di Sheets belum muncul): buka Apps Script editor,
// pilih function 'generatePasswordHash' di dropdown atas, ganti PLAIN_PASSWORD,
// klik Run, lalu buka View > Logs (Ctrl+Enter) untuk lihat hasil hash.
function generatePasswordHash() {
  const PLAIN_PASSWORD = 'GANTI_INI'; // <-- ganti dengan password asli sebelum Run
  Logger.log(hashPassword_(PLAIN_PASSWORD));
}
