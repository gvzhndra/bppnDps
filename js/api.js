// ============================
// Komunikasi dengan Apps Script
// (fungsi sesi/login ada di js/auth.js, dipakai bersama index.html & login.html)
// ============================

function showLoading(text){
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if(textEl) textEl.textContent = text || 'Memproses...';
  if(overlay) overlay.classList.add('open');
}
function hideLoading(){
  const overlay = document.getElementById('loadingOverlay');
  if(overlay) overlay.classList.remove('open');
}

let toastTimer = null;
function showToast(text){
  const toast = document.getElementById('toastMessage');
  if(!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

async function apiGet(action, extraParams){
  const params = new URLSearchParams(Object.assign(
    { action: action || "getAset", token: getToken() || "", _t: Date.now() },
    extraParams || {}
  ));
  const res = await fetch(API_URL + "?" + params.toString());
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch(e) {
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      return { ok: false, error: "Koneksi ke Apps Script bermasalah (Server mengembalikan halaman HTML/Drive). Pastikan Web App disetel 'Anyone' (Siapa saja) di Apps Script." };
    }
    if (isSessionError(text)) {
      return { ok: false, error: "Sesi login tidak valid atau sudah kedaluwarsa. Silakan login ulang." };
    }
    return { ok: false, error: "Respon server tidak valid: " + text.substring(0, 80) };
  }
}
async function apiSend(action, payload){
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ action, token: getToken() }, payload))
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch(e) {
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      return { ok: false, error: "Koneksi ke Apps Script bermasalah (Server mengembalikan halaman HTML/Drive). Pastikan Web App disetel 'Anyone' (Siapa saja) di Apps Script." };
    }
    if (isSessionError(text)) {
      return { ok: false, error: "Sesi login tidak valid atau sudah kedaluwarsa. Silakan login ulang." };
    }
    return { ok: false, error: "Respon server tidak valid: " + text.substring(0, 80) };
  }
}

async function loadFromServer(){
  if(API_URL.indexOf("GANTI_DENGAN_URL") !== -1){
    document.getElementById('sidePanel').innerHTML =
      '<div class="empty-hint">Dashboard belum tersambung ke Google Sheets. Isi API_URL di bagian atas kode dashboard (setelah Apps Script di-deploy) untuk mulai memuat & menyimpan data dari Sheets.</div>';
    return;
  }
  showLoading('Memuat data...');
  try{
    const res = await apiGet("getAset");
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return; }
      alert("Gagal memuat data: " + res.error); return;
    }
    sheetHeaders = res.headers || [];
    features = res.features.map(f => {
      const base = { id: f.id, geomType: f.geomType, props: f.props || {} };
      if(f.geomType === "point") base.point = geometryToInternal("point", f.geometry);
      else base.coords = geometryToInternal("polygon", f.geometry);
      return base;
    });
    renderAll();
  } catch(err){
    alert("Tidak bisa terhubung ke Apps Script. Cek kembali API_URL dan status deployment.\n" + err);
  } finally {
    hideLoading();
  }
}

async function persistAsset(a){
  if(API_URL.indexOf("GANTI_DENGAN_URL") !== -1) return;
  showLoading('Menyimpan aset...');
  try{
    const payload = { id:a.id, geomType:a.geomType, geometry: internalToGeometry(a), props: a.props };
    // DEBUG: log exactly what kluster value is being sent
    console.log('[DEBUG] persistAsset payload:', JSON.stringify({
      id: payload.id,
      kluster: payload.props.kluster,
      props_keys: Object.keys(payload.props)
    }));
    const res = await apiSend("update", { asset: payload });
    console.log('[DEBUG] update response:', JSON.stringify(res));
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return; }
      alert("Gagal menyimpan ke Google Sheets: " + res.error);
    } else {
      showToast('✓ Tersimpan ke Google Sheets');
    }
  } catch(err){
    alert("Gagal menyimpan ke Google Sheets: " + err);
  } finally {
    hideLoading();
  }
}
async function deleteAssetOnServer(id){
  if(API_URL.indexOf("GANTI_DENGAN_URL") !== -1) return;
  showLoading('Menghapus aset...');
  try{
    const res = await apiSend("delete", { id });
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return; }
      alert("Gagal menghapus di Google Sheets: " + res.error);
    } else {
      showToast('✓ Aset dihapus');
    }
  } catch(err){
    alert("Gagal menghapus di Google Sheets: " + err);
  } finally {
    hideLoading();
  }
}

// ============================
// Riwayat dokumen per aset
// ============================
async function fetchHistory(assetId){
  try{
    const res = await apiGet("getHistory", { asset_id: assetId });
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return []; }
      alert("Gagal memuat riwayat: " + res.error);
      return [];
    }
    return res.history || [];
  } catch(err){
    alert("Gagal memuat riwayat: " + err);
    return [];
  }
}
async function addHistoryEntry(entry){
  showLoading('Menambah riwayat...');
  try{
    const res = await apiSend("addHistory", { entry });
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return null; }
      alert("Gagal menambah riwayat: " + res.error);
      return null;
    }
    showToast('✓ Riwayat ditambahkan');
    return res;
  } catch(err){
    alert("Gagal menambah riwayat: " + err);
    return null;
  } finally {
    hideLoading();
  }
}
async function deleteHistoryEntry(id){
  showLoading('Menghapus riwayat...');
  try{
    const res = await apiSend("deleteHistory", { id });
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return false; }
      alert("Gagal menghapus riwayat: " + res.error);
      return false;
    }
    showToast('✓ Riwayat dihapus');
    return true;
  } catch(err){
    alert("Gagal menghapus riwayat: " + err);
    return false;
  } finally {
    hideLoading();
  }
}

// ============================
// Foto & Geotagging per aset
// ============================
async function addPhotoToServer(assetId, photoObj) {
  // photoObj: { base64, filename, mimeType, sumber_tag, lat, lng }
  return await apiSend("addPhoto", {
    entry: {
      asset_id: assetId,
      base64: photoObj.base64,
      filename: photoObj.filename,
      mimeType: photoObj.mimeType,
      sumber_tag: photoObj.sumber_tag,
      lat: photoObj.lat,
      lng: photoObj.lng
    }
  });
}

async function fetchPhotos(assetId){
  try{
    const res = await apiGet("getPhotos", { asset_id: assetId });
    console.log('[DEBUG fetchPhotos] assetId:', assetId, 'response:', res);
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return []; }
      alert("Gagal memuat foto: " + res.error);
      return [];
    }
    return res.photos || [];
  } catch(err){
    console.error('[DEBUG fetchPhotos] error:', err);
    alert("Gagal memuat foto: " + err);
    return [];
  }
}
async function addPhoto(entry){
  try{
    // DEBUG: log exactly what's being sent (without dumping the full base64 string)
    console.log('[DEBUG addPhoto] sending:', JSON.stringify({
      asset_id: entry.asset_id,
      mimeType: entry.mimeType,
      base64_length: entry.base64 ? entry.base64.length : 0,
      lat: entry.lat,
      lng: entry.lng,
      sumber_tag: entry.sumber_tag,
      token_present: !!getToken(),
      role: (getSession() || {}).role
    }));
    const res = await apiSend("addPhoto", { entry });
    console.log('[DEBUG addPhoto] response:', JSON.stringify(res));
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return res; }
      console.warn("Gagal menambah foto: " + res.error);
    }
    return res;
  } catch(err){
    console.error("[DEBUG addPhoto] threw exception:", err);
    console.error("Gagal menambah foto: " + err);
    return { ok: false, error: err.toString() };
  }
}
async function addPhotoBatch(entries){
  try{
    const res = await apiSend("addPhotoBatch", { entries });
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return res; }
      console.warn("Gagal menambah batch foto: " + res.error);
    }
    return res;
  } catch(err){
    console.error("Gagal menambah batch foto: " + err);
    return { ok: false, error: err.toString() };
  }
}
async function deletePhoto(id){
  showLoading('Menghapus foto...');
  try{
    const res = await apiSend("deletePhoto", { id });
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return false; }
      alert("Gagal menghapus foto: " + res.error);
      return false;
    }
    showToast('✓ Foto dihapus');
    return true;
  } catch(err){
    alert("Gagal menghapus foto: " + err);
    return false;
  } finally {
    hideLoading();
  }
}

// ============================
// Ekspor ke Excel
// ============================
async function exportToExcel(){
  showLoading('Menyiapkan file Excel...');
  try{
    const res = await apiSend("exportData", {});
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return null; }
      alert("Gagal ekspor: " + res.error);
      return null;
    }
    const byteChars = atob(res.base64);
    const byteNumbers = new Array(byteChars.length);
    for(let i = 0; i < byteChars.length; i++){
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = res.filename || 'ekspor-aset-eks-bppn.xlsx';
    link.click();
    URL.revokeObjectURL(url);
    showToast('✓ Excel diunduh');
    return res;
  } catch(err){
    alert("Gagal ekspor: " + err);
    return null;
  } finally {
    hideLoading();
  }
}
