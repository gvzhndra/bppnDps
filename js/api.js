// ============================
// Komunikasi dengan Apps Script
// (fungsi sesi/login ada di js/auth.js, dipakai bersama index.html & login.html)
// ============================

// ---- Overlay loading (freeze layar saat ada operasi simpan/hapus/ekspor) ----
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

async function apiGet(action, extraParams){
  const params = new URLSearchParams(Object.assign(
    { action: action || "getAset", token: getToken() || "" },
    extraParams || {}
  ));
  const res = await fetch(API_URL + "?" + params.toString());
  return res.json();
}
async function apiSend(action, payload){
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // penting: hindari CORS preflight di Apps Script
    body: JSON.stringify(Object.assign({ action, token: getToken() }, payload))
  });
  return res.json();
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
    const res = await apiSend("update", { asset: { id:a.id, geomType:a.geomType, geometry: internalToGeometry(a), props: a.props } });
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return; }
      alert("Gagal menyimpan ke Google Sheets: " + res.error);
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
    return true;
  } catch(err){
    alert("Gagal menghapus riwayat: " + err);
    return false;
  } finally {
    hideLoading();
  }
}

// ============================
// Ekspor ke Google Sheets (admin-only, ditegakkan juga di Code.gs)
// ============================
async function exportToSheets(){
  showLoading('Menyiapkan ekspor...');
  try{
    const res = await apiSend("exportData", {});
    if(!res.ok){
      if(isSessionError(res.error)){ handleSessionExpired(); return null; }
      alert("Gagal ekspor: " + res.error);
      return null;
    }
    return res;
  } catch(err){
    alert("Gagal ekspor: " + err);
    return null;
  } finally {
    hideLoading();
  }
}
