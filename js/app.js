function newId(){
  return "A" + Date.now() + Math.floor(Math.random()*1000);
}

function geometryToInternal(geomType, geometry){
  if(!geometry) return geomType === "point" ? [-8.65, 115.22] : [];
  if(geomType === "point"){
    return [geometry.coordinates[1], geometry.coordinates[0]];
  }
  if(geometry.type === "Polygon"){
    return geometry.coordinates[0].map(c => [c[1], c[0]]);
  }
  if(geometry.type === "MultiPolygon"){
    return geometry.coordinates[0][0].map(c => [c[1], c[0]]);
  }
  return [];
}
function internalToGeometry(a){
  if(a.geomType === "point"){
    return { type:"Point", coordinates:[a.point[1], a.point[0]] };
  }
  return { type:"Polygon", coordinates:[a.coords.map(c => [c[1], c[0]])] };
}

const map = L.map('map', {scrollWheelZoom:true}).setView([-8.65, 115.22], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:18}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: { polygon:true, marker:false, circle:false, circlemarker:false, polyline:false, rectangle:false },
  edit: { featureGroup: drawnItems, remove:false }
});

map.on(L.Draw.Event.CREATED, function(e){
  const layer = e.layer;
  const latlngs = layer.getLatLngs()[0].map(p => [p.lat, p.lng]);
  const newAsset = {
    id: newId(),
    geomType: "polygon",
    coords: latlngs,
    props: { kode_aset:"Kode aset", lokasi:"", status:"Dalam Penitipan", luas:0, no_dokumen:0, jenis_dokumen:"", catatan:"" }
  };
  features.push(newAsset);
  renderAll();
  selectAsset(newAsset.id, 'edit');
  persistAsset(newAsset);
  map.removeControl(drawControl);
  if(btnDraw) btnDraw.textContent = "Gambar poligon baru";
  drawing = false;
});

let drawing = false;

const btnDraw = document.getElementById('btnDraw');

if (btnDraw) {
  btnDraw.addEventListener('click', () => {

    if (!drawing) {
      map.addControl(drawControl);
      new L.Draw.Polygon(map).enable();
      btnDraw.textContent = "Batal menggambar";
      drawing = true;
    } else {
      map.removeControl(drawControl);
      btnDraw.textContent = "Gambar poligon baru";
      drawing = false;
    }

  });
}



document.getElementById('btnAddPoint').addEventListener('click', () => {
  const center = map.getCenter();
  const newAsset = {
    id: newId(),
    geomType: "point",
    point: [center.lat, center.lng],
    props: { kode_aset:"Aset baru (titik)", lokasi:"", status:"Dalam Penitipan", luas:0, no_dokumen:0, jenis_dokumen:"", catatan:"Geometri masih titik perkiraan, belum ada hasil trace." }
  };
  features.push(newAsset);
  renderAll();
  selectAsset(newAsset.id, 'edit');
  persistAsset(newAsset);
});

document.getElementById('btnExport').addEventListener('click', () => {
  const fc = {
    type: "FeatureCollection",
    features: features.map(a => ({
      type: "Feature",
      properties: a.props,
      geometry: a.geomType === "point"
        ? { type: "Point", coordinates: [a.point[1], a.point[0]] }
        : { type: "Polygon", coordinates: [a.coords.map(c => [c[1], c[0]])] }
    }))
  };
  const blob = new Blob([JSON.stringify(fc, null, 2)], {type:"application/geo+json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = "aset-eks-bppn-denpasar.geojson";
  a.click();
  URL.revokeObjectURL(url);
});

function currentFilter(){
  return document.getElementById('filterStatus').value;
}
function currentSearch(){
  return document.getElementById('search').value.toLowerCase();
}
function matchesSearch(a, s){
  if(!s) return true;
  return (a.props.kode_aset||"").toLowerCase().includes(s)
    || (a.props.lokasi||"").toLowerCase().includes(s)
    || (a.props.status||"").toLowerCase().includes(s)
    || (a.props.jenis_dokumen||"").toLowerCase().includes(s);
}

document.getElementById('filterStatus').addEventListener('change', renderAll);
document.getElementById('search').addEventListener('input', renderAll);

function visibleFeatures(){
  const f = currentFilter();
  const s = currentSearch();
  return features.filter(a => {
    if(f !== 'all' && a.props.status !== f) return false;
    if(!matchesSearch(a, s)) return false;
    return true;
  });
}

function renderAll(){
  Object.values(leafletLayers).forEach(l => map.removeLayer(l));
  leafletLayers = {};
  const vis = visibleFeatures();
  vis.forEach(a => {
    const color = statusColor[a.props.status] || "#6B7280";
    let layer;
    if(a.geomType === "point"){
      layer = L.circleMarker(a.point, {radius:9, color:color, weight:2, fillColor:color, fillOpacity:0.7}).addTo(map);
    } else {
      layer = L.polygon(a.coords, {color:color, weight:2, fillColor:color, fillOpacity:0.35}).addTo(map);
    }
    layer.on('click', () => selectAsset(a.id));
    leafletLayers[a.id] = layer;
  });

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = "";
  vis.forEach(a => {
    const tr = document.createElement('tr');
    const geomLabel = a.geomType === "point" ? "Titik" : "Poligon";
    tr.innerHTML = `<td>${escapeHtml(a.props.kode_aset)}</td><td>${escapeHtml(a.props.lokasi)}</td>
      <td>${geomLabel}</td>
      <td>${(a.props.luas).toLocaleString('id-ID')}</td>
      <td><span class="badge" style="background:${statusColor[a.props.status]||'#6B7280'}">${escapeHtml(a.props.status)}</span></td>
      <td>${escapeHtml(a.props.no_dokumen || "")}</td>
      <td>${escapeHtml(a.props.jenis_dokumen)}</td>
      <td style="white-space:nowrap;">
        <button class="btnViewRow" data-id="${a.id}" style="padding:4px 10px;">Lihat</button>
      </td>`;
    tr.addEventListener('click', () => selectAsset(a.id));
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btnViewRow').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); selectAsset(btn.dataset.id); });
  });

  const belumPunyaKoordinat = vis.filter(a => !a.point && !a.coords).length;

  const batasBelumDitemukan = vis.filter(a => a.geomType !== "polygon").length;

  document.getElementById('statTotal').textContent = vis.length;
  document.getElementById('statLuas').textContent = vis.reduce((s,a)=>s+Number(a.props.luas),0).toLocaleString('id-ID');
  document.getElementById('statTitik').textContent = belumPunyaKoordinat;
  document.getElementById('statPolygon').textContent = batasBelumDitemukan;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

let panelMode = 'view'; // 'view' | 'edit'

function selectAsset(id, mode){
  selectedId = id;
  panelMode = mode || 'view';
  const a = features.find(x => x.id === id);
  if(!a) return;
  const layer = leafletLayers[id];
  if(layer){
    if(a.geomType === "point") map.setView(a.point, Math.max(map.getZoom(), 15));
    else map.fitBounds(layer.getBounds(), {maxZoom:16});
  }
  if(panelMode === 'edit') renderEditPanel(a);
  else renderViewPanel(a);
}

function renderViewPanel(a){
  const extraKeys = sheetHeaders.filter(h => RESERVED_COLUMNS.indexOf(h) === -1 && CORE_PROPS.indexOf(h) === -1);
  const extraSection = extraKeys.length ? `
    <div class="field" style="border-top:1px dashed var(--border);padding-top:10px;margin-top:10px;">
      <label style="font-weight:500;color:var(--text);margin-bottom:8px;display:block;">Data tambahan (kolom custom dari Google Sheets)</label>
      ${extraKeys.map(k => `
        <div class="view-row"><span class="view-label">${escapeHtml(k)}</span><span class="view-value">${escapeHtml(a.props[k] || '-')}</span></div>
      `).join('')}
    </div>
  ` : '';

  const geomInfo = a.geomType === "point"
    ? `Titik (${a.point[0].toFixed(6)}, ${a.point[1].toFixed(6)})`
    : `Poligon (${a.coords.length} titik)`;

  const actionButtons = isAdmin() ? `
    <div class="actions-row">
      <button class="primary" id="btnEditAsset">Edit</button>
      <button class="danger" id="btnDeleteAsset">Hapus aset</button>
    </div>
  ` : '';

  const addHistoryForm = isAdmin() ? `
    <div class="row2" style="margin-top:10px;">
      <div class="field"><label>No. Dokumen</label><input type="text" id="hist-no_dokumen"></div>
      <div class="field"><label>Tanggal</label><input type="date" id="hist-tanggal"></div>
    </div>
    <div class="field"><label>Jenis dokumen (opsional)</label><input type="text" id="hist-jenis"></div>
    <div class="actions-row"><button class="primary" id="btnAddHistory" style="font-size:12px;">+ Tambah riwayat</button></div>
  ` : '';

  const panel = document.getElementById('sidePanel');
  panel.innerHTML = `
    <h3>Detail aset ${a.geomType === "point" ? '<span class="badge" style="background:#6B7280;">titik</span>' : '<span class="badge" style="background:#4C8C3F;">poligon</span>'}</h3>
    <div class="view-row"><span class="view-label">Kode aset</span><span class="view-value">${escapeHtml(a.props.kode_aset || "-")}</span></div>
    <div class="view-row"><span class="view-label">Lokasi</span><span class="view-value">${escapeHtml(a.props.lokasi || "-")}</span></div>
    <div class="view-row"><span class="view-label">Luas (m²)</span><span class="view-value">${Number(a.props.luas||0).toLocaleString('id-ID')}</span></div>
    <div class="view-row"><span class="view-label">Status</span><span class="badge" style="background:${statusColor[a.props.status]||'#6B7280'}">${escapeHtml(a.props.status || "-")}</span></div>
    <div class="view-row"><span class="view-label">No. Dokumen</span><span class="view-value">${escapeHtml(a.props.no_dokumen || "-")}</span></div>
    <div class="view-row"><span class="view-label">Jenis dokumen</span><span class="view-value">${escapeHtml(a.props.jenis_dokumen || "-")}</span></div>
    <div class="view-row"><span class="view-label">Catatan</span><span class="view-value">${escapeHtml(a.props.catatan || "-")}</span></div>
    <div class="view-row"><span class="view-label">Geometri</span><span class="view-value">${geomInfo}</span></div>
    ${extraSection}
    <div class="field" style="border-top:1px dashed var(--border);padding-top:10px;margin-top:10px;">
      <label style="font-weight:500;color:var(--text);margin-bottom:8px;display:block;">Riwayat dokumen</label>
      <div id="historyList" class="small-note">Memuat riwayat...</div>
      ${addHistoryForm}
    </div>
    ${actionButtons}
  `;
  if(isAdmin()){
    document.getElementById('btnEditAsset').addEventListener('click', () => selectAsset(a.id, 'edit'));
    document.getElementById('btnDeleteAsset').addEventListener('click', () => {
      if(confirm('Hapus aset ini?')){
        features = features.filter(x => x.id !== a.id);
        document.getElementById('sidePanel').innerHTML = '<div class="empty-hint">Belum ada aset yang dipilih.<br><br>Pilih salah satu aset pada tabel di bawah.</div>';
        renderAll();
        deleteAssetOnServer(a.id);
      }
    });
    document.getElementById('btnAddHistory').addEventListener('click', async () => {
      const no_dokumen = document.getElementById('hist-no_dokumen').value.trim();
      const tanggal = document.getElementById('hist-tanggal').value;
      const jenis_dokumen = document.getElementById('hist-jenis').value.trim();
      if(!no_dokumen || !tanggal){
        alert('No. Dokumen dan Tanggal wajib diisi.');
        return;
      }
      const res = await addHistoryEntry({ asset_id: a.id, no_dokumen, tanggal, jenis_dokumen });
      if(res) loadAndRenderHistory(a.id);
    });
  }
  loadAndRenderHistory(a.id);
}

async function loadAndRenderHistory(assetId){
  const container = document.getElementById('historyList');
  if(!container) return;
  const history = await fetchHistory(assetId);
  const stillOpen = document.getElementById('historyList');
  if(!stillOpen) return; // panel berpindah selagi menunggu respons server
  if(!history.length){
    stillOpen.innerHTML = '<p class="small-note" style="margin:0;">Belum ada riwayat dokumen.</p>';
    return;
  }
  const sorted = history.slice().sort((x,y) => new Date(x.tanggal) - new Date(y.tanggal));
  stillOpen.innerHTML = sorted.map(h => `
    <div class="history-item" data-hist-id="${h.id}">
      <div class="history-main">
        <strong>${escapeHtml(h.no_dokumen)}</strong>
        <span class="history-date">${escapeHtml(h.tanggal)}</span>
      </div>
      ${h.jenis_dokumen ? `<div class="small-note">${escapeHtml(h.jenis_dokumen)}</div>` : ''}
      ${isAdmin() ? `<button class="danger btnDeleteHistory" data-id="${h.id}" style="padding:2px 8px;font-size:11px;margin-top:4px;">Hapus</button>` : ''}
    </div>
  `).join('');
  if(isAdmin()){
    stillOpen.querySelectorAll('.btnDeleteHistory').forEach(btn => {
      btn.addEventListener('click', async () => {
        if(confirm('Hapus entri riwayat ini?')){
          const ok = await deleteHistoryEntry(btn.dataset.id);
          if(ok) loadAndRenderHistory(assetId);
        }
      });
    });
  }
}

function renderEditPanel(a){

  const geomSection = a.geomType === "point" ? `
    <div class="row2">
      <div class="field"><label>Latitude</label><input type="number" step="0.000001" id="f-lat" value="${a.point[0]}"></div>
      <div class="field"><label>Longitude</label><input type="number" step="0.000001" id="f-lng" value="${a.point[1]}"></div>
    </div>
    <div class="field" style="background:#F7F9FA;border:1px dashed var(--border);border-radius:6px;padding:10px;">
      <label style="margin-bottom:6px;">Sudah ada hasil trace GeoJSON untuk aset ini? Tempel di sini:</label>
      <textarea id="f-geojson" rows="4" placeholder='{"type":"Feature","geometry":{"type":"Polygon","coordinates":[...]}}'></textarea>
      <div class="actions-row" style="margin-top:8px;">
        <button id="btnApplyGeojson" class="primary" style="font-size:12px;">Terapkan sebagai poligon</button>
      </div>
    </div>
  ` : `
    <div class="field"><p class="small-note">Geometri: poligon (${a.coords.length} titik). Untuk mengganti bentuk, hapus aset ini dan tambahkan ulang, atau gambar ulang lewat "Gambar poligon baru".</p></div>
  `;

  const extraKeys = sheetHeaders.filter(h => RESERVED_COLUMNS.indexOf(h) === -1 && CORE_PROPS.indexOf(h) === -1);
  const extraSection = extraKeys.length ? `
    <div class="field" style="border-top:1px dashed var(--border);padding-top:10px;margin-top:4px;">
      <label style="font-weight:500;color:var(--text);margin-bottom:8px;">Data tambahan (kolom custom dari Google Sheets)</label>
      ${extraKeys.map(k => `
        <div class="field">
          <label>${escapeHtml(k)}</label>
          <input type="text" class="f-extra" data-key="${escapeHtml(k)}" value="${escapeHtml(a.props[k] || '')}">
        </div>
      `).join('')}
    </div>
  ` : '';

  const panel = document.getElementById('sidePanel');
  panel.innerHTML = `
    <h3>Edit aset ${a.geomType === "point" ? '<span class="badge" style="background:#6B7280;">titik</span>' : '<span class="badge" style="background:#4C8C3F;">poligon</span>'}</h3>
    <div class="field"><label>Kode aset</label><input type="text" id="f-kode_aset" value="${escapeHtml(a.props.kode_aset || "")}"></div>
    <div class="field"><label>Lokasi</label><input type="text" id="f-lokasi" value="${escapeHtml(a.props.lokasi)}"></div>
    <div class="row2">
      <div class="field"><label>Luas (m²)</label><input type="number" id="f-luas" value="${a.props.luas}"></div>
      <div class="field"><label>Status</label>
        <select id="f-status">
          ${Object.keys(statusColor).map(s => `<option value="${s}" ${s===a.props.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="row2">
      <div class="field"><label>No. Dokumen </label><input type="text" id="f-no_dokumen" value="${a.props.no_dokumen || ""}"></div>
      <div class="field"><label>Jenis dokumen</label><input type="text" id="f-jenis_dokumen" value="${escapeHtml(a.props.jenis_dokumen || "")}"></div>
    </div>
    <div class="field"><label>Catatan</label><textarea id="f-catatan" rows="3">${escapeHtml(a.props.catatan)}</textarea></div>
    ${geomSection}
    ${extraSection}
    <div class="actions-row">
      <button class="primary" id="btnSave">Simpan</button>
      <button id="btnCancelEdit">Batal</button>
    </div>
  `;
  document.getElementById('btnSave').addEventListener('click', () => {
    a.props.kode_aset = document.getElementById('f-kode_aset').value;
    a.props.lokasi = document.getElementById('f-lokasi').value;
    a.props.luas = Number(document.getElementById('f-luas').value) || 0;
    a.props.status = document.getElementById('f-status').value;
    a.props.no_dokumen = document.getElementById('f-no_dokumen').value;
    a.props.jenis_dokumen = document.getElementById('f-jenis_dokumen').value;
    a.props.catatan = document.getElementById('f-catatan').value;
    document.querySelectorAll('.f-extra').forEach(inp => { a.props[inp.dataset.key] = inp.value; });
    if(a.geomType === "point"){
      const lat = Number(document.getElementById('f-lat').value);
      const lng = Number(document.getElementById('f-lng').value);
      if(!isNaN(lat) && !isNaN(lng)) a.point = [lat, lng];
    }
    renderAll();
    selectAsset(a.id, 'view');
    persistAsset(a);
  });
  document.getElementById('btnCancelEdit').addEventListener('click', () => {
    selectAsset(a.id, 'view');
  });
  if(a.geomType === "point"){
    document.getElementById('btnApplyGeojson').addEventListener('click', () => {
      const raw = document.getElementById('f-geojson').value.trim();
      if(!raw) return;
      try{
        const gj = JSON.parse(raw);
        let feature = null;
        let geom;
        if(gj.type === "FeatureCollection"){
          if(!gj.features || !gj.features.length){
            alert("FeatureCollection tidak berisi feature apa pun.");
            return;
          }
          if(gj.features.length > 1){
            alert("GeoJSON ini berisi " + gj.features.length + " feature. Cuma feature pertama yang akan dipakai untuk aset ini.");
          }
          feature = gj.features[0];
          geom = feature.geometry;
        } else if(gj.type === "Feature"){
          feature = gj;
          geom = gj.geometry;
        } else {
          geom = gj;
        }
        let coords = [];
        if(geom.type === "Polygon"){
          coords = geom.coordinates[0].map(c => [c[1], c[0]]);
        } else if(geom.type === "MultiPolygon"){
          coords = geom.coordinates[0][0].map(c => [c[1], c[0]]);
        } else {
          alert("Geometri harus berupa Polygon atau MultiPolygon.");
          return;
        }
        a.geomType = "polygon";
        a.coords = coords;
        delete a.point;
        if(feature && feature.properties){
          const p = feature.properties;
          if(p.luas || p.area) a.props.luas = p.luas || p.area;
        }
        renderAll();
        selectAsset(a.id, 'edit');
        persistAsset(a);
      } catch(e){
        alert("GeoJSON tidak valid: " + e.message);
      }
    });
  }
}

// ============================
// Sesi & role UI
// (login/logout sekarang di halaman terpisah login.html + js/auth.js + js/login.js;
// guardDashboardPage() di <head> index.html sudah melempar ke login.html duluan
// kalau belum ada sesi tersimpan sama sekali)
// ============================
function renderUserBadge(){
  const session = getSession();
  const userInfo = document.getElementById('userInfo');
  const btnLogout = document.getElementById('btnLogout');
  if(!session){
    if(userInfo) userInfo.textContent = '';
    if(btnLogout) btnLogout.style.display = 'none';
    return;
  }
  if(userInfo) userInfo.textContent = "Halo, " + (session.nama || session.username) + "! (" + (session.role === ROLES.ADMIN ? "admin" : "viewer") + ")";
  if(btnLogout) btnLogout.style.display = 'inline-block';
}

function applyRoleUI(){
  const admin = isAdmin();
  const addBtn = document.getElementById('btnAddPoint');
  if(addBtn) addBtn.style.display = admin ? '' : 'none';
  if(btnDraw) btnDraw.style.display = admin ? '' : 'none';
}

document.getElementById('btnLogout').addEventListener('click', () => {
  clearSession();
  window.location.href = 'login.html';
});

document.getElementById('btnRefresh').addEventListener('click', () => {
  loadFromServer();
});

// ---- mulai aplikasi ----
// (guardDashboardPage() sudah dipanggil lebih dulu di <head>; kalau sampai di
// sini berarti ada sesi tersimpan, meskipun bisa saja sudah kedaluwarsa di
// server -- loadFromServer() akan menangani itu dan melempar ke login.html)
renderUserBadge();
applyRoleUI();
renderAll();
loadFromServer();
