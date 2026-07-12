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

// Hitung titik tengah (centroid) poligon dari daftar [lat,lng].
// Dihitung ulang setiap ditampilkan (bukan disimpan) supaya selalu akurat
// walau bentuk poligonnya diubah, dan tidak perlu kolom tambahan di Sheets.
function computeCentroid(coordsLatLng){
  if(!coordsLatLng || coordsLatLng.length < 3){
    return coordsLatLng && coordsLatLng[0] ? coordsLatLng[0] : [0, 0];
  }
  const pts = coordsLatLng.map(c => [c[1], c[0]]); // ke [lng, lat] biar x=lng, y=lat
  let area = 0, cx = 0, cy = 0;
  const n = pts.length;
  for(let i = 0; i < n; i++){
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area = area / 2;
  if(Math.abs(area) < 1e-12){
    const avgLat = coordsLatLng.reduce((s, c) => s + c[0], 0) / coordsLatLng.length;
    const avgLng = coordsLatLng.reduce((s, c) => s + c[1], 0) / coordsLatLng.length;
    return [avgLat, avgLng];
  }
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return [cy, cx]; // balik ke [lat, lng]
}

function defaultAssetProps(overrides){
  return Object.assign({
    kode_aset: "",
    lokasi: "",
    status: "Dalam Penitipan",
    kategori_penitipan: "Belum Dimanfaatkan",
    jenis_pemanfaatan: "",
    alasan_selesai_penitipan: "",
    luas: 0,
    no_dokumen: "",
    jenis_dokumen: "",
    catatan: "",
    link_folder: ""
  }, overrides || {});
}

// Badge status + kategori (dipakai di tabel & panel detail)
function statusBadgesHtml(props){
  let html = `<span class="badge" style="background:${statusColor[props.status]||'#6B7280'}">${escapeHtml(props.status || "-")}</span>`;
  if(props.status === "Dalam Penitipan" && props.kategori_penitipan){
    const kColor = kategoriColor[props.kategori_penitipan] || '#6B7280';
    html += ` <span class="badge" style="background:${kColor}">${escapeHtml(props.kategori_penitipan)}</span>`;
  }
  return html;
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
    props: defaultAssetProps({ kode_aset:"Kode aset" })
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
    props: defaultAssetProps({ kode_aset:"Aset baru (titik)", catatan:"Geometri masih titik perkiraan, belum ada hasil trace." })
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
    || (a.props.kategori_penitipan||"").toLowerCase().includes(s)
    || (a.props.jenis_pemanfaatan||"").toLowerCase().includes(s)
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

function getPrimaryColor(props){
  if(props.status === "Dalam Penitipan" && props.kategori_penitipan && kategoriColor[props.kategori_penitipan]){
    return kategoriColor[props.kategori_penitipan];
  }
  return statusColor[props.status] || "#6B7280";
}

function renderAll(){
  Object.values(leafletLayers).forEach(l => map.removeLayer(l));
  leafletLayers = {};
  const vis = visibleFeatures();
  vis.forEach(a => {
    const color = getPrimaryColor(a.props);
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
      <td><div class="badge-group">${statusBadgesHtml(a.props)}</div></td>
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
  const dalamPenitipan = vis.filter(a => a.props.status === "Dalam Penitipan");
  const belumDimanfaatkanCount = dalamPenitipan.filter(a => !a.props.kategori_penitipan || a.props.kategori_penitipan === "Belum Dimanfaatkan").length;
  const pemanfaatanCount = dalamPenitipan.filter(a => a.props.kategori_penitipan === "Pemanfaatan").length;
  const bermasalahCount = dalamPenitipan.filter(a => a.props.kategori_penitipan === "Bermasalah Hukum").length;
  const berakhirCount = vis.filter(a => a.props.status === "Penitipan Berakhir").length;

  document.getElementById('statTotal').textContent = vis.length;
  document.getElementById('statLuas').textContent = vis.reduce((s,a)=>s+Number(a.props.luas),0).toLocaleString('id-ID');
  document.getElementById('statTitik').textContent = belumPunyaKoordinat;
  document.getElementById('statPolygon').textContent = batasBelumDitemukan;
  document.getElementById('statDalamPenitipan').textContent = dalamPenitipan.length;
  document.getElementById('statBelumDimanfaatkan').textContent = belumDimanfaatkanCount;
  document.getElementById('statPemanfaatan').textContent = pemanfaatanCount;
  document.getElementById('statBermasalah').textContent = bermasalahCount;
  document.getElementById('statBerakhir').textContent = berakhirCount;
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
    : (() => {
        const c = computeCentroid(a.coords);
        return `Poligon (${a.coords.length} titik) — titik tengah: ${c[0].toFixed(6)}, ${c[1].toFixed(6)}`;
      })();

  const kategoriRow = (a.props.status === "Dalam Penitipan" && a.props.kategori_penitipan)
    ? `<div class="view-row"><span class="view-label">Kategori</span><span class="view-value">${escapeHtml(a.props.kategori_penitipan)}</span></div>`
    : '';
  const jenisPemanfaatanRow = (a.props.status === "Dalam Penitipan" && a.props.kategori_penitipan === "Pemanfaatan" && a.props.jenis_pemanfaatan)
    ? `<div class="view-row"><span class="view-label">Jenis pemanfaatan</span><span class="view-value">${escapeHtml(a.props.jenis_pemanfaatan)}</span></div>`
    : '';
  const alasanRow = (a.props.status === "Penitipan Berakhir" && a.props.alasan_selesai_penitipan)
    ? `<div class="view-row"><span class="view-label">Alasan selesai</span><span class="view-value">${escapeHtml(a.props.alasan_selesai_penitipan)}</span></div>`
    : '';
  const linkFolderRow = a.props.link_folder
    ? `<div class="view-row"><span class="view-label">Folder berkas</span><span class="view-value"><a href="${escapeHtml(a.props.link_folder)}" target="_blank" rel="noopener" style="color:#1F78B4;">Link dokumen</a></span></div>`
    : '';

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
    <div class="view-row"><span class="view-label">ID Sistem</span><span class="view-value" style="font-family:monospace;font-size:11px;">${escapeHtml(a.id)}</span></div>
    <p class="small-note" style="margin:-4px 0 8px;">↑ Ini yang harus dipakai sebagai <code>asset_id</code> kalau menambah riwayat manual lewat tab Riwayat di Sheets (bukan kode_aset).</p>
    <div class="view-row"><span class="view-label">Kode aset</span><span class="view-value">${escapeHtml(a.props.kode_aset || "-")}</span></div>
    <div class="view-row"><span class="view-label">Lokasi</span><span class="view-value">${escapeHtml(a.props.lokasi || "-")}</span></div>
    <div class="view-row"><span class="view-label">Luas (m²)</span><span class="view-value">${Number(a.props.luas||0).toLocaleString('id-ID')}</span></div>
    <div class="view-row"><span class="view-label">Status</span><div class="badge-group">${statusBadgesHtml(a.props)}</div></div>
    ${kategoriRow}
    ${jenisPemanfaatanRow}
    ${alasanRow}
    <div class="view-row"><span class="view-label">No. Dokumen</span><span class="view-value">${escapeHtml(a.props.no_dokumen || "-")}</span></div>
    <div class="view-row"><span class="view-label">Jenis dokumen</span><span class="view-value">${escapeHtml(a.props.jenis_dokumen || "-")}</span></div>
    <div class="view-row"><span class="view-label">Catatan</span><span class="view-value">${escapeHtml(a.props.catatan || "-")}</span></div>
    ${linkFolderRow}
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
      if(res){
        document.getElementById('hist-no_dokumen').value = '';
        document.getElementById('hist-tanggal').value = '';
        document.getElementById('hist-jenis').value = '';
        loadAndRenderHistory(a.id);
      }
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

  const geojsonBox = `
    <div class="field" style="background:#F7F9FA;border:1px dashed var(--border);border-radius:6px;padding:10px;">
      <label style="margin-bottom:6px;">${a.geomType === "point" ? "Sudah ada hasil trace GeoJSON untuk aset ini? Tempel di sini:" : "Mau ganti bentuk poligon (tanpa hapus aset, riwayat tetap tersambung)? Tempel GeoJSON baru di sini:"}</label>
      <textarea id="f-geojson" rows="4" placeholder='{"type":"Feature","geometry":{"type":"Polygon","coordinates":[...]}}'></textarea>
      <div class="actions-row" style="margin-top:8px;">
        <button id="btnApplyGeojson" class="primary" style="font-size:12px;">Terapkan sebagai poligon</button>
      </div>
    </div>
  `;

  const geomSection = a.geomType === "point" ? `
    <div class="row2">
      <div class="field"><label>Latitude</label><input type="number" step="0.000001" id="f-lat" value="${a.point[0]}"></div>
      <div class="field"><label>Longitude</label><input type="number" step="0.000001" id="f-lng" value="${a.point[1]}"></div>
    </div>
    ${geojsonBox}
  ` : (() => {
      const c = computeCentroid(a.coords);
      return `<div class="field"><p class="small-note">Geometri: poligon (${a.coords.length} titik), titik tengah (centroid) otomatis: <strong>${c[0].toFixed(6)}, ${c[1].toFixed(6)}</strong>.</p></div>${geojsonBox}`;
    })();

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
          ${STATUS_OPTIONS.map(s => `<option value="${s}" ${s===a.props.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field" id="wrap-kategori" style="display:none;">
      <label>Kategori</label>
      <select id="f-kategori_penitipan">
        ${KATEGORI_OPTIONS.map(k => `<option value="${k}" ${k===a.props.kategori_penitipan?'selected':''}>${k}</option>`).join('')}
      </select>
    </div>
    <div class="field" id="wrap-jenis_pemanfaatan" style="display:none;">
      <label>Jenis pemanfaatan (ketik manual)</label>
      <input type="text" id="f-jenis_pemanfaatan" value="${escapeHtml(a.props.jenis_pemanfaatan || "")}" placeholder="mis. disewakan ke Dinas X, dipakai gudang, dll.">
    </div>
    <div class="field" id="wrap-alasan" style="display:none;">
      <label>Alasan selesai penitipan (ketik manual)</label>
      <input type="text" id="f-alasan_selesai_penitipan" value="${escapeHtml(a.props.alasan_selesai_penitipan || "")}" placeholder="mis. dikembalikan ke pemilik, dilelang, dll.">
    </div>
    <div class="row2">
      <div class="field"><label>No. Dokumen </label><input type="text" id="f-no_dokumen" value="${a.props.no_dokumen || ""}"></div>
      <div class="field"><label>Jenis dokumen</label><input type="text" id="f-jenis_dokumen" value="${escapeHtml(a.props.jenis_dokumen || "")}"></div>
    </div>
    <div class="field"><label>Catatan</label><textarea id="f-catatan" rows="3">${escapeHtml(a.props.catatan)}</textarea></div>
    <div class="field"><label>Link folder berkas (OneDrive, satu per aset)</label><input type="text" id="f-link_folder" value="${escapeHtml(a.props.link_folder || "")}" placeholder="https://onedrive.live.com/... atau link SharePoint"></div>
    ${geomSection}
    ${extraSection}
    <div class="actions-row">
      <button class="primary" id="btnSave">Simpan</button>
      <button id="btnCancelEdit">Batal</button>
    </div>
  `;

  function updateConditionalFields(){
    const status = document.getElementById('f-status').value;
    const wrapKategori = document.getElementById('wrap-kategori');
    const wrapJenis = document.getElementById('wrap-jenis_pemanfaatan');
    const wrapAlasan = document.getElementById('wrap-alasan');
    wrapKategori.style.display = status === "Dalam Penitipan" ? '' : 'none';
    wrapAlasan.style.display = status === "Penitipan Berakhir" ? '' : 'none';
    const kategori = document.getElementById('f-kategori_penitipan').value;
    wrapJenis.style.display = (status === "Dalam Penitipan" && kategori === "Pemanfaatan") ? '' : 'none';
  }
  updateConditionalFields();
  document.getElementById('f-status').addEventListener('change', updateConditionalFields);
  document.getElementById('f-kategori_penitipan').addEventListener('change', updateConditionalFields);

  document.getElementById('btnSave').addEventListener('click', () => {
    a.props.kode_aset = document.getElementById('f-kode_aset').value;
    a.props.lokasi = document.getElementById('f-lokasi').value;
    a.props.luas = Number(document.getElementById('f-luas').value) || 0;
    a.props.status = document.getElementById('f-status').value;
    a.props.kategori_penitipan = a.props.status === "Dalam Penitipan" ? document.getElementById('f-kategori_penitipan').value : "";
    a.props.jenis_pemanfaatan = (a.props.status === "Dalam Penitipan" && a.props.kategori_penitipan === "Pemanfaatan") ? document.getElementById('f-jenis_pemanfaatan').value : "";
    a.props.alasan_selesai_penitipan = a.props.status === "Penitipan Berakhir" ? document.getElementById('f-alasan_selesai_penitipan').value : "";
    a.props.no_dokumen = document.getElementById('f-no_dokumen').value;
    a.props.jenis_dokumen = document.getElementById('f-jenis_dokumen').value;
    a.props.catatan = document.getElementById('f-catatan').value;
    a.props.link_folder = document.getElementById('f-link_folder').value;
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
  const hint = document.getElementById('hintTambahAset');
  if(hint) hint.style.display = admin ? '' : 'none';
  const exportBtn = document.getElementById('btnExportSheets');
  if(exportBtn) exportBtn.style.display = admin ? '' : 'none';
}

document.getElementById('btnExportSheets').addEventListener('click', async () => {
  if(!isAdmin()) return;
  if(!confirm('Unduh data (Aset & Riwayat) sebagai file Excel?')) return;
  await exportToExcel();
});

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
