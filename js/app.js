function newId() {
  return "A" + Date.now() + Math.floor(Math.random() * 1000);
}

function getNormalizedAsalAset(val) {
  const str = String(val || '').trim().toLowerCase();
  if (str.includes('ppa')) return "Eks PT PPA";
  return "Eks BPPN";
}

function getLuasTanah(props) {
  if (!props) return 0;
  if (props.luas_tanah !== undefined && props.luas_tanah !== null && props.luas_tanah !== '') return Number(props.luas_tanah) || 0;
  if (props['Luas Tanah'] !== undefined && props['Luas Tanah'] !== null && props['Luas Tanah'] !== '') return Number(props['Luas Tanah']) || 0;
  if (props.luas !== undefined && props.luas !== null && props.luas !== '') return Number(props.luas) || 0;
  if (props['Luas'] !== undefined && props['Luas'] !== null && props['Luas'] !== '') return Number(props['Luas']) || 0;
  return 0;
}

function getLuasBangunan(props) {
  if (!props) return 0;
  if (props.luas_bangunan !== undefined && props.luas_bangunan !== null && props.luas_bangunan !== '') return Number(props.luas_bangunan) || 0;
  if (props['Luas Bangunan'] !== undefined && props['Luas Bangunan'] !== null && props['Luas Bangunan'] !== '') return Number(props['Luas Bangunan']) || 0;
  return 0;
}

function formatMultilineText(str) {
  if (str === undefined || str === null || String(str).trim() === "") return "-";
  let text = escapeHtml(str);
  text = text.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
  text = text.replace(/\r?\n/g, '<br>');
  return text;
}

function isMobileOrTablet() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  return isMobileUA || (hasTouch && window.innerWidth <= 1024);
}

function geometryToInternal(geomType, geometry) {
  if (!geometry) return geomType === "point" ? [0, 0] : [];
  if (geomType === "point") {
    if (geometry.coordinates && geometry.coordinates.length >= 2) {
      const lng = Number(geometry.coordinates[0]);
      const lat = Number(geometry.coordinates[1]);
      if (!isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)) {
        return [lat, lng];
      }
    }
    return [0, 0];
  }
  if (geometry.type === "Polygon" && geometry.coordinates && geometry.coordinates[0]) {
    return geometry.coordinates[0].map(c => [Number(c[1]), Number(c[0])]);
  }
  if (geometry.type === "MultiPolygon" && geometry.coordinates && geometry.coordinates[0] && geometry.coordinates[0][0]) {
    return geometry.coordinates[0][0].map(c => [Number(c[1]), Number(c[0])]);
  }
  return [];
}

function internalToGeometry(a) {
  if (a.geomType === "point") {
    return { type: "Point", coordinates: [Number(a.point[1]), Number(a.point[0])] };
  }
  return { type: "Polygon", coordinates: [a.coords.map(c => [Number(c[1]), Number(c[0])])] };
}

function isValidPoint(point) {
  if (!point || !Array.isArray(point) || point.length < 2) return false;
  const lat = Number(point[0]), lng = Number(point[1]);
  if (isNaN(lat) || isNaN(lng)) return false;
  return !(lat === 0 && lng === 0);
}

function isValidPolygonCoords(coords) {
  return !!coords && Array.isArray(coords) && coords.length >= 3;
}

function computeCentroid(coordsLatLng) {
  if (!coordsLatLng || coordsLatLng.length < 3) {
    return coordsLatLng && coordsLatLng[0] ? [Number(coordsLatLng[0][0]), Number(coordsLatLng[0][1])] : [0, 0];
  }
  const pts = coordsLatLng.map(c => [Number(c[1]), Number(c[0])]);
  let area = 0, cx = 0, cy = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area = area / 2;
  if (Math.abs(area) < 1e-12) {
    const avgLat = coordsLatLng.reduce((s, c) => s + Number(c[0]), 0) / coordsLatLng.length;
    const avgLng = coordsLatLng.reduce((s, c) => s + Number(c[1]), 0) / coordsLatLng.length;
    return [avgLat, avgLng];
  }
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return [cy, cx];
}

function parseCoordsFromString(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (!str) return null;
  const match = str.match(/([-+]?\d{1,2}\.\d+)\s*[\s,]\s*([-+]?\d{1,3}\.\d+)/);
  if (match) {
    const c1 = Number(match[1]), c2 = Number(match[2]);
    if (!isNaN(c1) && !isNaN(c2) && !(c1 === 0 && c2 === 0)) {
      if (c1 < 15 && c1 > -15 && c2 > 90 && c2 < 150) return [c1, c2];
      if (c2 < 15 && c2 > -15 && c1 > 90 && c1 < 150) return [c2, c1];
      return [c1, c2];
    }
  }
  return null;
}

function googleEarthUrl(lat, lng) {
  return `https://earth.google.com/web/@${lat},${lng},500a,35y,0h,0t,0r`;
}

function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}&t=k`;
}

function getAssetCoordinates(a) {
  if (!a) return null;
  if (a.geomType === "polygon" && isValidPolygonCoords(a.coords)) {
    return computeCentroid(a.coords);
  }
  if (a.geomType === "point" && isValidPoint(a.point)) {
    return [Number(a.point[0]), Number(a.point[1])];
  }
  if (a.props) {
    for (const key in a.props) {
      const parsed = parseCoordsFromString(a.props[key]);
      if (parsed) return parsed;
    }
  }
  return null;
}

function defaultAssetProps(overrides) {
  return Object.assign({
    kode_aset: "",
    asal_aset: "Eks BPPN",
    lokasi: "",
    kluster: "",
    status: "Dalam Penitipan",
    kategori_penitipan: "Belum Dimanfaatkan",
    keterangan_kategori: "",
    jenis_pemanfaatan: "",
    alasan_selesai_penitipan: "",
    luas_tanah: 0,
    luas_bangunan: 0,
    luas: 0,
    no_dokumen: "",
    jenis_dokumen: "",
    catatan: "",
    link_folder: ""
  }, overrides || {});
}

function statusBadgesHtml(props) {
  let html = `<span class="badge" style="background:${statusColor[props.status] || '#6B7280'}">${escapeHtml(props.status || "-")}</span>`;
  if (props.status === "Dalam Penitipan" && props.kategori_penitipan) {
    const kColor = kategoriColor[props.kategori_penitipan] || '#6B7280';
    let label = escapeHtml(props.kategori_penitipan);
    if (props.kategori_penitipan === "Lain-lain" && props.keterangan_kategori) {
      label += ` (${escapeHtml(props.keterangan_kategori)})`;
    }
    html += ` <span class="badge" style="background:${kColor}">${label}</span>`;
  }
  return html;
}

// Inisialisasi Peta Leaflet
const map = L.map('map', { scrollWheelZoom: true }).setView([-8.65, 115.22], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

// Invalidate size agar peta Leaflet menyesuaikan ukuran layar mobile saat load/resize
window.addEventListener('resize', () => { setTimeout(() => map.invalidateSize(), 200); });
setTimeout(() => map.invalidateSize(), 300);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: { polygon: true, marker: false, circle: false, circlemarker: false, polyline: false, rectangle: false },
  edit: { featureGroup: drawnItems, remove: false }
});

map.on(L.Draw.Event.CREATED, function (e) {
  const layer = e.layer;
  const latlngs = layer.getLatLngs()[0].map(p => [p.lat, p.lng]);
  const newAsset = {
    id: newId(),
    geomType: "polygon",
    coords: latlngs,
    props: defaultAssetProps({ kode_aset: "Kode aset" })
  };
  features.push(newAsset);
  renderAll();
  selectAsset(newAsset.id, 'edit');
  persistAsset(newAsset);
  map.removeControl(drawControl);
  if (btnDraw) btnDraw.textContent = "Gambar poligon baru";
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
    props: defaultAssetProps({ kode_aset: "Aset baru (titik)", catatan: "Geometri masih titik perkiraan, belum ada hasil trace." })
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
  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = "aset-eks-bppn-denpasar.geojson";
  a.click();
  URL.revokeObjectURL(url);
});

function currentFilterStatus() {
  const el = document.getElementById('filterStatus');
  return el ? el.value : 'all';
}
function currentFilterAsal() {
  const el = document.getElementById('filterAsal');
  return el ? el.value : 'all';
}
function currentSearch() {
  const el = document.getElementById('search');
  return el ? el.value.toLowerCase() : '';
}
function getClusterValue(props) {
  if (!props) return '';
  if (props.kluster !== undefined && props.kluster !== null && String(props.kluster).trim() !== '') return String(props.kluster).trim();
  if (props.Kluster !== undefined && props.Kluster !== null && String(props.Kluster).trim() !== '') return String(props.Kluster).trim();
  if (props['Kluster Aset'] !== undefined && props['Kluster Aset'] !== null && String(props['Kluster Aset']).trim() !== '') return String(props['Kluster Aset']).trim();
  if (props.kluster_aset !== undefined && props.kluster_aset !== null && String(props.kluster_aset).trim() !== '') return String(props.kluster_aset).trim();
  return '';
}

function matchesSearch(a, s) {
  if (!s) return true;
  return (a.props.kode_aset || "").toLowerCase().includes(s)
    || (a.props.asal_aset || "").toLowerCase().includes(s)
    || (a.props.lokasi || "").toLowerCase().includes(s)
    || getClusterValue(a.props).toLowerCase().includes(s)
    || (a.props.status || "").toLowerCase().includes(s)
    || (a.props.kategori_penitipan || "").toLowerCase().includes(s)
    || (a.props.jenis_pemanfaatan || "").toLowerCase().includes(s)
    || (a.props.jenis_dokumen || "").toLowerCase().includes(s);
}

let currentTab = 'kluster'; // Tab default: Kluster Aset
let specialFilter = null; // null, 'no_coord', atau 'no_poly'

function smoothScrollToTable() {
  const el = document.getElementById('tableWrap');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function switchTab(tabName) {
  currentTab = tabName;
  const tabKluster = document.getElementById('tabKluster');
  const tabSemua = document.getElementById('tabSemua');
  const viewKluster = document.getElementById('viewKluster');
  const viewSemua = document.getElementById('viewSemua');

  if (tabName === 'kluster') {
    if (tabKluster) tabKluster.classList.add('active');
    if (tabSemua) tabSemua.classList.remove('active');
    if (viewKluster) viewKluster.style.display = 'block';
    if (viewSemua) viewSemua.style.display = 'none';
  } else {
    if (tabSemua) tabSemua.classList.add('active');
    if (tabKluster) tabKluster.classList.remove('active');
    if (viewSemua) viewSemua.style.display = 'block';
    if (viewKluster) viewKluster.style.display = 'none';
  }
}

const filterStatusEl = document.getElementById('filterStatus');
if (filterStatusEl) filterStatusEl.addEventListener('change', () => { specialFilter = null; currentPage = 1; renderAll(); });
const filterAsalEl = document.getElementById('filterAsal');
if (filterAsalEl) filterAsalEl.addEventListener('change', () => { specialFilter = null; currentPage = 1; renderAll(); });
const searchEl = document.getElementById('search');
if (searchEl) searchEl.addEventListener('input', () => { specialFilter = null; currentPage = 1; renderAll(); });

function getKategoriPenitipanValue(props) {
  if (!props) return '';
  if (props.kategori_penitipan !== undefined && props.kategori_penitipan !== null && String(props.kategori_penitipan).trim() !== '') return String(props.kategori_penitipan).trim();
  if (props.kategori !== undefined && props.kategori !== null && String(props.kategori).trim() !== '') return String(props.kategori).trim();
  if (props.status_penitipan !== undefined && props.status_penitipan !== null && String(props.status_penitipan).trim() !== '') return String(props.status_penitipan).trim();
  if (props.status !== undefined && props.status !== null && String(props.status).trim() !== '' && props.status !== 'Dalam Penitipan') return String(props.status).trim();
  return '';
}

function visibleFeatures() {
  const fStatus = currentFilterStatus();
  const fAsal = currentFilterAsal();
  const s = currentSearch();
  return features.filter(a => {
    if (specialFilter === 'no_coord') {
      if (a.geomType === "point" && isValidPoint(a.point)) return false;
      if (a.geomType === "polygon" && isValidPolygonCoords(a.coords)) return false;
    } else if (specialFilter === 'no_poly') {
      if (a.geomType === "polygon" && isValidPolygonCoords(a.coords)) return false;
    }
    if (fStatus !== 'all') {
      const kat = getKategoriPenitipanValue(a.props);
      if (kat !== fStatus) return false;
    }
    if (fAsal !== 'all') {
      if (getNormalizedAsalAset(a.props.asal_aset) !== fAsal) return false;
    }
    if (!matchesSearch(a, s)) return false;
    return true;
  });
}

function getUniqueClusters(assetList) {
  const set = new Set();
  const list = assetList || features;
  list.forEach(a => {
    const k = getClusterValue(a.props);
    if (k) set.add(k);
  });
  return Array.from(set).sort();
}

function groupAssetsByCluster(assetList) {
  const groups = {};
  assetList.forEach(a => {
    const name = getClusterValue(a.props) || 'Tanpa Kluster';
    if (!groups[name]) groups[name] = [];
    groups[name].push(a);
  });

  const sortedKeys = Object.keys(groups).sort((x, y) => {
    if (x === 'Tanpa Kluster') return 1;
    if (y === 'Tanpa Kluster') return -1;
    return x.localeCompare(y);
  });

  const sortedGroups = {};
  sortedKeys.forEach(k => { sortedGroups[k] = groups[k]; });
  return sortedGroups;
}

function renderClusterTable(vis) {
  const container = document.getElementById('clusterContainer');
  if (!container) return;

  const groups = groupAssetsByCluster(vis);
  const clusterKeys = Object.keys(groups);

  if (clusterKeys.length === 0) {
    container.innerHTML = '<p class="small-note" style="margin:12px 0;">Tidak ada aset yang sesuai dengan kriteria filter.</p>';
    return;
  }

  let html = '';
  clusterKeys.forEach((name, idx) => {
    const assets = groups[name];
    const totalCount = assets.length;
    const luasTanah = assets.reduce((s, a) => s + getLuasTanah(a.props), 0);
    const luasBangunan = assets.reduce((s, a) => s + getLuasBangunan(a.props), 0);

    const sudah = assets.filter(a => a.props.kategori_penitipan === 'Sudah Dimanfaatkan' || a.props.kategori_penitipan === 'Dimanfaatkan').length;
    const belum = assets.filter(a => a.props.kategori_penitipan === 'Belum Dimanfaatkan').length;
    const masalah = assets.filter(a => a.props.kategori_penitipan === 'Bermasalah Hukum').length;
    const lain = assets.filter(a => a.props.kategori_penitipan === 'Lain-lain').length;

    html += `
      <div class="cluster-card ${idx === 0 ? 'open' : ''}" data-cluster-name="${escapeHtml(name)}">
        <div class="cluster-header">
          <div class="cluster-title">
            <span class="cluster-icon">▶</span>
            <span>${escapeHtml(name)}</span>
            <span class="cluster-badge">${totalCount} aset</span>
          </div>
          <div class="cluster-metrics">
            <span>Tanah: <strong>${luasTanah.toLocaleString('id-ID')} m²</strong></span>
            <span>Bangunan: <strong>${luasBangunan.toLocaleString('id-ID')} m²</strong></span>
            <div class="badge-group">
              ${sudah > 0 ? `<span class="badge" style="background:#1D9E75;">${sudah} dimanfaatkan</span>` : ''}
              ${belum > 0 ? `<span class="badge" style="background:#94A3B8;">${belum} belum</span>` : ''}
              ${masalah > 0 ? `<span class="badge" style="background:#B23A3A;">${masalah} masalah</span>` : ''}
              ${lain > 0 ? `<span class="badge" style="background:#7C3AED;">${lain} lain</span>` : ''}
            </div>
            <button class="primary btnFocusCluster" data-cluster="${escapeHtml(name)}" style="padding:4px 10px;font-size:12px;">📍 Fokus di Peta</button>
          </div>
        </div>
        <div class="cluster-details-wrap">
          <table>
            <thead>
              <tr>
                <th>Kode Aset</th>
                <th>Asal Aset</th>
                <th>Lokasi</th>
                <th>Geometri</th>
                <th>Luas Tanah (m²)</th>
                <th>Luas Bangunan (m²)</th>
                <th>Status</th>
                <th>No. Dokumen</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${assets.map(a => `
                <tr class="rowClusterAsset" data-id="${a.id}">
                  <td>${escapeHtml(a.props.kode_aset || "-")}</td>
                  <td><span class="badge" style="background:#1B3A5C;">${escapeHtml(getNormalizedAsalAset(a.props.asal_aset))}</span></td>
                  <td>${escapeHtml(a.props.lokasi || "-")}</td>
                  <td>${a.geomType === "point" ? "Titik" : "Poligon"}</td>
                  <td>${getLuasTanah(a.props).toLocaleString('id-ID')}</td>
                  <td>${getLuasBangunan(a.props).toLocaleString('id-ID')}</td>
                  <td><div class="badge-group">${statusBadgesHtml(a.props)}</div></td>
                  <td>${escapeHtml(a.props.no_dokumen || "-")}</td>
                  <td><button class="btnViewRow" data-id="${a.id}" style="padding:4px 10px;">Lihat</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.cluster-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.btnFocusCluster')) return;
      const card = header.closest('.cluster-card');
      card.classList.toggle('open');
    });
  });

  container.querySelectorAll('.btnFocusCluster').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const clusterName = btn.dataset.cluster;
      const clusterAssets = groups[clusterName] || [];
      const bounds = [];
      clusterAssets.forEach(a => {
        if (a.geomType === 'point' && isValidPoint(a.point)) {
          bounds.push(a.point);
        } else if (a.geomType === 'polygon' && isValidPolygonCoords(a.coords)) {
          a.coords.forEach(c => bounds.push(c));
        }
      });
      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 16 });
      } else {
        alert('Tidak ada geometri valid untuk aset dalam kluster ini.');
      }
    });
  });

  container.querySelectorAll('.rowClusterAsset').forEach(row => {
    row.addEventListener('click', () => selectAsset(row.dataset.id));
  });
  container.querySelectorAll('.btnViewRow').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectAsset(btn.dataset.id);
    });
  });
}

function getPrimaryColor(props) {
  if (props.status === "Dalam Penitipan" && props.kategori_penitipan && kategoriColor[props.kategori_penitipan]) {
    return kategoriColor[props.kategori_penitipan];
  }
  return statusColor[props.status] || "#6B7280";
}

function renderAll() {
  Object.values(leafletLayers).forEach(l => map.removeLayer(l));
  leafletLayers = {};
  const vis = visibleFeatures();
  vis.forEach(a => {
    const color = getPrimaryColor(a.props);
    let layer;
    if (a.geomType === "point") {
      if (isValidPoint(a.point)) {
        layer = L.circleMarker(a.point, { radius: 9, color: color, weight: 2, fillColor: color, fillOpacity: 0.7 }).addTo(map);
        layer.on('click', () => selectAsset(a.id));
        leafletLayers[a.id] = layer;
      }
    } else {
      if (isValidPolygonCoords(a.coords)) {
        layer = L.polygon(a.coords, { color: color, weight: 2, fillColor: color, fillOpacity: 0.35 }).addTo(map);
        layer.on('click', () => selectAsset(a.id));
        leafletLayers[a.id] = layer;
      }
    }
  });

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = "";

  const totalPages = Math.max(1, Math.ceil(vis.length / TABLE_PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const pageItems = vis.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

  pageItems.forEach(a => {
    const tr = document.createElement('tr');
    const geomLabel = a.geomType === "point" ? "Titik" : "Poligon";
    const luasTanahVal = getLuasTanah(a.props);
    const luasBangunanVal = getLuasBangunan(a.props);

    tr.innerHTML = `<td>${escapeHtml(a.props.kode_aset || "-")}</td>
      <td><span class="badge" style="background:#1B3A5C;">${escapeHtml(getNormalizedAsalAset(a.props.asal_aset))}</span></td>
      <td>${escapeHtml(a.props.lokasi || "-")}</td>
      <td><span class="badge" style="background:#475569;">${escapeHtml(getClusterValue(a.props) || "Tanpa Kluster")}</span></td>
      <td>${geomLabel}</td>
      <td>${luasTanahVal.toLocaleString('id-ID')}</td>
      <td>${luasBangunanVal.toLocaleString('id-ID')}</td>
      <td><div class="badge-group">${statusBadgesHtml(a.props)}</div></td>
      <td>${escapeHtml(a.props.no_dokumen || "-")}</td>
      <td>${escapeHtml(a.props.jenis_dokumen || "-")}</td>
      <td style="white-space:nowrap;">
        <button class="btnViewRow" data-id="${a.id}" style="padding:4px 10px;">Lihat</button>
      </td>`;
    tr.addEventListener('click', () => selectAsset(a.id));
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btnViewRow').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); selectAsset(btn.dataset.id); });
  });
  renderPagination(vis.length, totalPages);
  renderClusterTable(vis);

  const belumPunyaKoordinat = vis.filter(a => {
    if (a.geomType === "point") return !isValidPoint(a.point);
    return !isValidPolygonCoords(a.coords);
  }).length;
  const batasBelumDitemukan = vis.filter(a => a.geomType !== "polygon").length;
  const sudahDimanfaatkanCount = vis.filter(a => {
    const k = getKategoriPenitipanValue(a.props);
    return k === "Sudah Dimanfaatkan" || k === "Dimanfaatkan";
  }).length;
  const belumDimanfaatkanCount = vis.filter(a => getKategoriPenitipanValue(a.props) === "Belum Dimanfaatkan").length;
  const bermasalahCount = vis.filter(a => getKategoriPenitipanValue(a.props) === "Bermasalah Hukum").length;
  const lainLainCount = vis.filter(a => getKategoriPenitipanValue(a.props) === "Lain-lain").length;

  const totalLuasTanah = vis.reduce((s, a) => s + getLuasTanah(a.props), 0);
  const totalLuasBangunan = vis.reduce((s, a) => s + getLuasBangunan(a.props), 0);

  document.getElementById('statTotal').textContent = vis.length;
  const statTotalKlusterEl = document.getElementById('statTotalKluster');
  if (statTotalKlusterEl) statTotalKlusterEl.textContent = getUniqueClusters(vis).length;
  const statLuasTanahEl = document.getElementById('statLuasTanah');
  const statLuasBangunanEl = document.getElementById('statLuasBangunan');
  const statLuasEl = document.getElementById('statLuas');
  if (statLuasTanahEl) statLuasTanahEl.textContent = totalLuasTanah.toLocaleString('id-ID');
  if (statLuasBangunanEl) statLuasBangunanEl.textContent = totalLuasBangunan.toLocaleString('id-ID');
  if (statLuasEl) statLuasEl.textContent = totalLuasTanah.toLocaleString('id-ID');
  document.getElementById('statTitik').textContent = belumPunyaKoordinat;
  document.getElementById('statPolygon').textContent = batasBelumDitemukan;
  const statSudahEl = document.getElementById('statSudahDimanfaatkan');
  if (statSudahEl) statSudahEl.textContent = sudahDimanfaatkanCount;
  document.getElementById('statBelumDimanfaatkan').textContent = belumDimanfaatkanCount;
  document.getElementById('statBermasalah').textContent = bermasalahCount;
  document.getElementById('statBerakhir').textContent = lainLainCount;
}

function renderPagination(totalItems, totalPages) {
  const container = document.getElementById('pagination');
  if (!container) return;
  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }
  const start = (currentPage - 1) * TABLE_PAGE_SIZE + 1;
  const end = Math.min(currentPage * TABLE_PAGE_SIZE, totalItems);
  container.innerHTML = `
    <span class="small-note" style="margin:0;">Menampilkan ${start}-${end} dari ${totalItems} aset</span>
    <div class="pagination-buttons">
      <button id="btnPrevPage" ${currentPage <= 1 ? 'disabled' : ''}>‹ Sebelumnya</button>
      <span class="small-note" style="margin:0;">Halaman ${currentPage} / ${totalPages}</span>
      <button id="btnNextPage" ${currentPage >= totalPages ? 'disabled' : ''}>Berikutnya ›</button>
    </div>
  `;
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  if (btnPrev) btnPrev.addEventListener('click', () => { currentPage--; renderAll(); });
  if (btnNext) btnNext.addEventListener('click', () => { currentPage++; renderAll(); });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let panelMode = 'view';

function getAssetCoordinates(a) {
  if (!a) return null;
  if (a.geomType === "point" && isValidPoint(a.point)) {
    return [Number(a.point[0]), Number(a.point[1])];
  }
  if (a.geomType === "polygon" && isValidPolygonCoords(a.coords)) {
    return computeCentroid(a.coords);
  }
  if (a.props) {
    const lat = Number(a.props.latitude || a.props.lat);
    const lng = Number(a.props.longitude || a.props.lng || a.props.long);
    if (!isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)) {
      return [lat, lng];
    }
  }
  return null;
}

function selectAsset(id, mode) {
  selectedId = id;
  panelMode = mode || 'view';
  const a = features.find(x => x.id === id);
  if (!a) return;
  const layer = leafletLayers[id];
  if (layer) {
    if (a.geomType === "point") { if (isValidPoint(a.point)) map.setView(a.point, Math.max(map.getZoom(), 15)); }
    else if (isValidPolygonCoords(a.coords)) map.fitBounds(layer.getBounds(), { maxZoom: 16 });
  }
  if (panelMode === 'edit') renderEditPanel(a);
  else renderViewPanel(a);

  const panel = document.getElementById('sidePanel');
  if (panel) {
    panel.classList.add('open');
    panel.scrollTo({ top: 0, behavior: 'smooth' });
    updateToggleButtons();
  }
  
  // Buka drawer foto secara otomatis saat aset dipilih
  openFotoModal(a.id, a.props.kode_aset || a.id);
}

function updateToggleButtons() {
  var drawerLeft = document.getElementById('fotoDrawer');
  var drawerRight = document.getElementById('sidePanel');
  var btnToggleLeft = document.getElementById('btnToggleLeft');
  var btnToggleRight = document.getElementById('btnToggleRight');
  var iconLeft = document.getElementById('btnToggleLeftIcon');
  var iconRight = document.getElementById('btnToggleRightIcon');
  
  if (selectedId && drawerRight) {
    if (btnToggleRight) btnToggleRight.style.display = 'flex';
    var isOpen = drawerRight.classList.contains('open');
    if (iconRight) iconRight.textContent = isOpen ? '❯' : '❮';
  } else {
    if (btnToggleRight) btnToggleRight.style.display = 'none';
  }

  if (selectedId && drawerLeft) {
    if (btnToggleLeft) btnToggleLeft.style.display = 'flex';
    var isOpen = drawerLeft.classList.contains('open');
    if (iconLeft) iconLeft.textContent = isOpen ? '❮' : '❯';
  } else {
    if (btnToggleLeft) btnToggleLeft.style.display = 'none';
  }
}

function renderViewPanel(a) {
  const extraKeys = sheetHeaders.filter(h => RESERVED_COLUMNS.indexOf(h) === -1 && CORE_PROPS.indexOf(h) === -1);
  const extraSection = extraKeys.length ? `
    <div class="field" style="border-top:1px dashed var(--border);padding-top:10px;margin-top:10px;">
      <label style="font-weight:500;color:var(--text);margin-bottom:8px;display:block;">Data tambahan (kolom custom dari Google Sheets)</label>
      ${extraKeys.map(k => `
        <div class="view-row" style="align-items:flex-start;"><span class="view-label">${escapeHtml(k)}</span><span class="view-value" style="text-align:left;white-space:pre-wrap;">${formatMultilineText(a.props[k])}</span></div>
      `).join('')}
    </div>
  ` : '';

  const geomInfo = a.geomType === "point"
    ? (isValidPoint(a.point) ? `Titik (${Number(a.point[0]).toFixed(6)}, ${Number(a.point[1]).toFixed(6)})` : `Titik — belum ada koordinat`)
    : (isValidPolygonCoords(a.coords) ? (() => {
      const c = computeCentroid(a.coords);
      return `Poligon (${a.coords.length} titik) — titik tengah: ${c[0].toFixed(6)}, ${c[1].toFixed(6)}`;
    })() : `Poligon — belum ada koordinat`);

  const refCoords = getAssetCoordinates(a);
  const earthUrl = refCoords ? googleEarthUrl(refCoords[0], refCoords[1]) : null;
  const mapsUrl = refCoords ? googleMapsUrl(refCoords[0], refCoords[1]) : null;

  const kategoriRow = (a.props.status === "Dalam Penitipan" && a.props.kategori_penitipan)
    ? `<div class="view-row"><span class="view-label">Kategori</span><span class="view-value">${escapeHtml(a.props.kategori_penitipan)}</span></div>`
    : '';
  const keteranganKategoriRow = (a.props.status === "Dalam Penitipan" && a.props.kategori_penitipan === "Lain-lain" && a.props.keterangan_kategori)
    ? `<div class="view-row"><span class="view-label">Keterangan kategori</span><span class="view-value">${escapeHtml(a.props.keterangan_kategori)}</span></div>`
    : '';
  const alasanRow = '';
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
    <div class="actions-row"><button class="primary" id="btnAddHistory" style="font-size:12px;opacity:0.45;cursor:not-allowed;" disabled>+ Tambah riwayat</button></div>
  ` : '';

  const panel = document.getElementById('sidePanel');
  panel.innerHTML = `
    <h3>Detail aset ${a.geomType === "point" ? '<span class="badge" style="background:#6B7280;">titik</span>' : '<span class="badge" style="background:#4C8C3F;">poligon</span>'}</h3>
    <div class="view-row"><span class="view-label">ID Sistem</span><span class="view-value" style="font-family:monospace;font-size:11px;">${escapeHtml(a.id)}</span></div>
    <p class="small-note" style="margin:-4px 0 8px;">↑ Ini yang harus dipakai sebagai <code>asset_id</code> jika menambah riwayat manual lewat tab Riwayat di Sheets.</p>
    <div class="view-row"><span class="view-label">Kode aset</span><span class="view-value">${escapeHtml(a.props.kode_aset || "-")}</span></div>
    <div class="view-row"><span class="view-label">Asal aset</span><span class="view-value"><span class="badge" style="background:#1B3A5C;">${escapeHtml(getNormalizedAsalAset(a.props.asal_aset))}</span></span></div>
    <div class="view-row"><span class="view-label">Lokasi</span><span class="view-value">${escapeHtml(a.props.lokasi || "-")}</span></div>
    <div class="view-row"><span class="view-label">Kluster</span><span class="view-value">${escapeHtml(getClusterValue(a.props) || "Tanpa Kluster")}</span></div>
    <div class="view-row"><span class="view-label">Luas tanah (m²)</span><span class="view-value">${getLuasTanah(a.props).toLocaleString('id-ID')}</span></div>
    <div class="view-row"><span class="view-label">Luas bangunan (m²)</span><span class="view-value">${getLuasBangunan(a.props).toLocaleString('id-ID')}</span></div>
    <div class="view-row"><span class="view-label">Status</span><div class="badge-group">${statusBadgesHtml(a.props)}</div></div>
    ${kategoriRow}
    ${keteranganKategoriRow}
    <div class="view-row"><span class="view-label">No. Dokumen</span><span class="view-value">${escapeHtml(a.props.no_dokumen || "-")}</span></div>
    <div class="view-row"><span class="view-label">Jenis dokumen</span><span class="view-value">${escapeHtml(a.props.jenis_dokumen || "-")}</span></div>
    <div class="view-row" style="align-items:flex-start;"><span class="view-label">Catatan</span><span class="view-value" style="text-align:left;white-space:pre-wrap;">${formatMultilineText(a.props.catatan)}</span></div>
    ${linkFolderRow}
    <div class="view-row"><span class="view-label">Geometri</span><span class="view-value">${geomInfo}</span></div>
    ${earthUrl ? `
      <div class="view-row">
        <span class="view-label">Buka di Peta</span>
        <span class="view-value" style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;">
          <a href="${mapsUrl}" target="_blank" rel="noopener" style="color:#EA4335;font-weight:600;text-decoration:none;background:#FDF2F2;padding:5px 9px;border-radius:4px;font-size:12px;border:1px solid #FCA5A5;">📍 Google Maps (Pin Merah)</a>
          <a href="${earthUrl}" target="_blank" rel="noopener" style="color:#1F78B4;font-weight:600;text-decoration:none;background:#F0F4F8;padding:5px 9px;border-radius:4px;font-size:12px;border:1px solid #BAE6FD;">🌍 Google Earth 3D</a>
        </span>
      </div>
    ` : '<div class="view-row"><span class="view-label">Buka di Peta</span><span class="view-value" style="color:var(--text-mut);">Belum ada koordinat</span></div>'}
    ${extraSection}
    <div class="field" style="border-top:1px dashed var(--border);padding-top:10px;margin-top:10px;">
      <label style="font-weight:500;color:var(--text);margin-bottom:8px;display:block;">Riwayat dokumen</label>
      <div id="historyList" class="small-note">Memuat riwayat...</div>
      ${addHistoryForm}
    </div>
    ${actionButtons}
  `;
  if (isAdmin()) {
    document.getElementById('btnEditAsset').addEventListener('click', () => selectAsset(a.id, 'edit'));
    document.getElementById('btnDeleteAsset').addEventListener('click', () => {
      if (confirm('Hapus aset ini?')) {
        features = features.filter(x => x.id !== a.id);
        document.getElementById('sidePanel').innerHTML = '<div class="empty-hint">Belum ada aset yang dipilih.<br><br>Pilih salah satu aset pada tabel di bawah.</div>';
        renderAll();
        deleteAssetOnServer(a.id);
      }
    });
    const btnAddHist = document.getElementById('btnAddHistory');
    const inputNoDok = document.getElementById('hist-no_dokumen');
    const inputTgl = document.getElementById('hist-tanggal');
    if (btnAddHist && inputNoDok && inputTgl) {
      const updateHistBtnState = () => {
        const isValid = !!inputNoDok.value.trim() && !!inputTgl.value;
        btnAddHist.disabled = !isValid;
        btnAddHist.style.opacity = isValid ? '1' : '0.45';
        btnAddHist.style.cursor = isValid ? 'pointer' : 'not-allowed';
      };
      updateHistBtnState();
      inputNoDok.addEventListener('input', updateHistBtnState);
      inputTgl.addEventListener('change', updateHistBtnState);
      inputTgl.addEventListener('input', updateHistBtnState);
    }

    document.getElementById('btnAddHistory').addEventListener('click', async () => {
      const no_dokumen = document.getElementById('hist-no_dokumen').value.trim();
      const tanggal = document.getElementById('hist-tanggal').value;
      const jenis_dokumen = document.getElementById('hist-jenis').value.trim();
      if (!no_dokumen || !tanggal) {
        alert('No. Dokumen dan Tanggal wajib diisi.');
        return;
      }
      const res = await addHistoryEntry({ asset_id: a.id, no_dokumen, tanggal, jenis_dokumen });
      if (res) {
        document.getElementById('hist-no_dokumen').value = '';
        document.getElementById('hist-tanggal').value = '';
        document.getElementById('hist-jenis').value = '';
        loadAndRenderHistory(a.id);
        if (btnAddHist) btnAddHist.disabled = true;
      }
    });
  }
  loadAndRenderPhotos(a.id);
  loadAndRenderHistory(a.id);
}

// Kompresi foto lokal ke canvas JPEG base64 (Cepat, Hemat RAM, Permanent Base64)
function compressImageToBase64(file, maxDim = 800) {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
            else { w = Math.round(w * maxDim / h); h = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(null);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } catch(e) {
      resolve(null);
    }
  });
}

// Helper Simple Lightbox
function openSimpleLightbox(url, caption) {
  var modal = document.getElementById('simpleLightboxModal');
  var img = document.getElementById('simpleLightboxImg');
  var cap = document.getElementById('simpleLightboxCaption');
  if (modal && img) {
    img.src = url;
    if (cap) cap.textContent = caption || '';
    modal.style.display = 'flex';
  }
}
function closeSimpleLightbox() {
  var modal = document.getElementById('simpleLightboxModal');
  if (modal) modal.style.display = 'none';
}

function isValidIndonesiaGps(lat, lng) {
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return false;
  if (Math.abs(lat) < 1.5 && Math.abs(lng) < 1.5) return false;
  if (lat < -12 || lat > 8 || lng < 90 || lng > 143) return false;
  return true;
}

// Pembaca Geotag & EXIF Date dari JPEG File
async function getExifData(file) {
  return new Promise((resolve) => {
    if (!file || (!file.type.includes('jpeg') && !file.type.includes('jpg'))) {
      return resolve({ location: null, date: null });
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const view = new DataView(e.target.result);
        if (view.getUint16(0, false) !== 0xFFD8) return resolve({ location: null, date: null });
        let length = view.byteLength, offset = 2;
        let location = null, dateStr = null;

        while (offset < length) {
          if ((view.getUint16(offset, false) & 0xFF00) !== 0xFF00) break;
          const marker = view.getUint16(offset, false);
          if (marker === 0xFFE1) {
            const tiffOffset = offset + 10;
            const littleEndian = view.getUint16(tiffOffset, false) === 0x4949;

            // Extract EXIF Date (Tag 0x9003 / 0x0132)
            try {
              dateStr = readExifDate(view, tiffOffset, littleEndian);
            } catch(eDate) {}

            // Extract GPS Location
            const gpsOffset = findGpsOffset(view, tiffOffset, littleEndian);
            if (gpsOffset) {
              const lat = readGpsCoord(view, gpsOffset, 2, 1, littleEndian);
              const lng = readGpsCoord(view, gpsOffset, 4, 3, littleEndian);
              if (isValidIndonesiaGps(lat, lng)) {
                location = [lat, lng];
              }
            }
            return resolve({ location: location, date: dateStr });
          }
          offset += 2 + view.getUint16(offset + 2, false);
        }
        resolve({ location: null, date: null });
      } catch (err) {
        resolve({ location: null, date: null });
      }
    };
    reader.onerror = () => resolve({ location: null, date: null });
    reader.readAsArrayBuffer(file.slice(0, 128 * 1024));
  });
}

function readExifDate(view, tiffOffset, littleEndian) {
  const dirOffset = view.getUint32(tiffOffset + 4, littleEndian);
  const entries = view.getUint16(tiffOffset + dirOffset, littleEndian);
  let exifSubOffset = null, dateRaw = null;

  for (let i = 0; i < entries; i++) {
    const entryOffset = tiffOffset + dirOffset + 2 + i * 12;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === 0x8769) {
      exifSubOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
    } else if (tag === 0x0132) {
      dateRaw = readAsciiString(view, tiffOffset + view.getUint32(entryOffset + 8, littleEndian), 19);
    }
  }

  if (exifSubOffset) {
    const subEntries = view.getUint16(exifSubOffset, littleEndian);
    for (let j = 0; j < subEntries; j++) {
      const subEntryOffset = exifSubOffset + 2 + j * 12;
      const tag = view.getUint16(subEntryOffset, littleEndian);
      if (tag === 0x9003) {
        var valOffset = tiffOffset + view.getUint32(subEntryOffset + 8, littleEndian);
        dateRaw = readAsciiString(view, valOffset, 19);
        break;
      }
    }
  }

  if (dateRaw && dateRaw.length >= 10) {
    var parts = dateRaw.split(' ')[0].split(':');
    if (parts.length === 3) {
      return parts[0] + '-' + parts[1] + '-' + parts[2];
    }
  }
  return null;
}

function readAsciiString(view, offset, len) {
  try {
    let str = '';
    for (let i = 0; i < len; i++) {
      let charCode = view.getUint8(offset + i);
      if (charCode === 0) break;
      str += String.fromCharCode(charCode);
    }
    return str;
  } catch(e) {
    return null;
  }
}

function findGpsOffset(view, tiffOffset, littleEndian) {
  const dirOffset = view.getUint32(tiffOffset + 4, littleEndian);
  const entries = view.getUint16(tiffOffset + dirOffset, littleEndian);
  for (let i = 0; i < entries; i++) {
    const entryOffset = tiffOffset + dirOffset + 2 + i * 12;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === 0x8825) {
      return tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
    }
  }
  return null;
}

function readGpsCoord(view, gpsOffset, tagCoord, tagRef, littleEndian) {
  const entries = view.getUint16(gpsOffset, littleEndian);
  let ref = '', coord = null;
  for (let i = 0; i < entries; i++) {
    const entryOffset = gpsOffset + 2 + i * 12;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === tagRef) {
      ref = String.fromCharCode(view.getUint8(entryOffset + 8));
    } else if (tag === tagCoord) {
      const valOffset = gpsOffset + view.getUint32(entryOffset + 8, littleEndian);
      const dNum = view.getUint32(valOffset, littleEndian);
      const dDen = view.getUint32(valOffset + 4, littleEndian);
      const mNum = view.getUint32(valOffset + 8, littleEndian);
      const mDen = view.getUint32(valOffset + 12, littleEndian);
      const sNum = view.getUint32(valOffset + 16, littleEndian);
      const sDen = view.getUint32(valOffset + 20, littleEndian);
      const deg = (dDen ? dNum / dDen : 0) + (mDen ? mNum / mDen : 0) / 60 + (sDen ? sNum / sDen : 0) / 3600;
      coord = deg;
    }
  }
  if (coord !== null && ref) {
    if (ref === 'S' || ref === 'W') coord = -coord;
  }
  return coord;
}

// Ambil lokasi GPS dari browser HP
function getDeviceLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  });
}

// ============================================================
// GALERI FOTO MODAL — state terpusat
// ============================================================
var _fotoModalState = { assetId: null, assetName: '', photos: [] };

// Buka modal foto untuk sebuah aset
async function openFotoModal(assetId, assetName) {
  _fotoModalState.assetId = assetId;
  _fotoModalState.assetName = assetName;

  var drawer = document.getElementById('fotoDrawer');
  var titleEl = document.getElementById('fotoModalTitle');
  var subtitleEl = document.getElementById('fotoModalSubtitle');
  var grid = document.getElementById('fotoCardsGrid');
  var emptyState = document.getElementById('fotoEmptyState');
  var skeleton = document.getElementById('fotoSkeleton');

  if (titleEl) titleEl.textContent = 'Foto Lapangan';
  if (subtitleEl) subtitleEl.textContent = 'Aset: ' + assetName;

  if (grid) grid.style.display = 'none';
  if (emptyState) emptyState.style.display = 'none';
  if (skeleton) skeleton.style.display = 'grid';

  if (drawer) {
    drawer.classList.add('open');
    updateToggleButtons();
  }

  _injectKameraBtn();
  await loadAndRenderFotoModal(assetId);
}

function _injectKameraBtn() {
  var actionsEl = document.querySelector('.foto-modal-actions');
  if (!actionsEl) return;
  var existing = document.getElementById('btnKameraHP');
  if (existing) existing.remove();

  if (isMobileOrTablet()) {
    var btn = document.createElement('button');
    btn.className = 'btn-kamera-hp';
    btn.id = 'btnKameraHP';
    btn.innerHTML = '📷 Foto dengan Kamera';
    btn.addEventListener('click', function() {
      document.getElementById('fotoInputKamera').click();
    });
    actionsEl.appendChild(btn);
  }
}

// Muat dan render grid foto di dalam modal
async function loadAndRenderFotoModal(assetId) {
  var body = document.getElementById('fotoModalBody');
  if (!body) return;

  var photos = await fetchPhotos(assetId);
  _fotoModalState.photos = photos;
  renderFotoModalBodyFromState();
}

function renderFotoModalBodyFromState() {
  var emptyState = document.getElementById('fotoEmptyState');
  var grid = document.getElementById('fotoCardsGrid');
  var skeleton = document.getElementById('fotoSkeleton');
  var photos = _fotoModalState.photos || [];

  if (skeleton) skeleton.style.display = 'none';

  if (!photos.length) {
    if (emptyState) {
      emptyState.style.display = 'flex';
      var text = _fotoModalState.assetId ? 'Belum ada foto untuk aset ini.' : 'Pilih aset terlebih dahulu untuk melihat foto lapangan.';
      emptyState.innerHTML = '<span class="empty-icon">📷</span><p>' + text + '</p>';
    }
    if (grid) grid.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (grid) {
    grid.style.display = 'grid';
    renderPhotoCardsGrid(photos, grid);
  }
}

function renderPhotoCardsGrid(photos, gridEl) {
  var sumberLabel = {
    exif_foto: '📍 EXIF Foto', centroid: '📍 Titik Poligon',
    gps_hp: '📍 GPS HP', titik_aset: '📍 Titik Aset', tidak_diketahui: 'Lokasi ?'
  };

  gridEl.innerHTML = photos.map(function(p, i) {
    var isUploading = p.status === 'uploading';
    var isError = p.status === 'error';
    var isTemp = String(p.id || '').startsWith('temp_');
    var badgeText = isUploading ? '⚡ Mengunggah...' : (isError ? '❌ Gagal' : '');
    var badgeClass = isUploading ? 'uploading' : (isError ? 'error' : 'success');

    var tagText = sumberLabel[p.sumber_tag] || p.sumber_tag || '';
    var coordText = (p.lat && p.lng) ? '(' + Number(p.lat).toFixed(4) + ', ' + Number(p.lng).toFixed(4) + ')' : '';

    var displaySrc = p.url_foto || p.previewUrl || p.base64 || '';
    var fallbackSrc = p.previewUrl || p.base64 || p.url_foto || '';

    return '<div class="foto-card" id="fotoCard_' + (p.id || i) + '">' +
      '<div class="foto-card-img-wrap" onclick="openSimpleLightbox(\'' + escapeHtml(displaySrc) + '\', \'' + escapeHtml(p.tanggal || '') + '\')">' +
        '<img src="' + escapeHtml(displaySrc) + '" alt="Foto Aset ' + (i+1) + '" data-fallback="' + escapeHtml(fallbackSrc) + '" onerror="if(this.dataset.fallback && this.src!==this.dataset.fallback){this.src=this.dataset.fallback;}">' +
        (badgeText ? '<span class="foto-card-status-badge ' + badgeClass + '">' + badgeText + '</span>' : '') +
      '</div>' +
      '<div class="foto-card-body">' +
        '<div class="foto-card-meta">' +
          '<span style="font-weight:600;color:#334155;">Foto ' + (i+1) + ' · ' + escapeHtml(p.tanggal || 'Baru') + '</span>' +
          '<span>' + escapeHtml(tagText) + ' ' + escapeHtml(coordText) + '</span>' +
        '</div>' +
        '<div class="foto-card-actions">' +
          '<button class="btn-foto-action" onclick="openSimpleLightbox(\'' + escapeHtml(displaySrc) + '\', \'' + escapeHtml(p.tanggal || '') + '\')">🔍 Lihat Full</button>' +
          ((isAdmin() && !isTemp && !isUploading) ? '<button class="btn-foto-action delete" onclick="handleDeletePhotoFromCard(\'' + p.id + '\')">🗑️ Hapus</button>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function handleDeletePhotoFromCard(photoId) {
  if (!confirm('Hapus foto ini dari server?')) return;
  var ok = await deletePhoto(photoId);
  if (ok) {
    _fotoModalState.photos = (_fotoModalState.photos || []).filter(function(x) { return x.id !== photoId; });
    renderFotoModalBodyFromState();
  }
}

// ============================================================
// INSTANT PREVIEW MULTIPLE UPLOAD ENGINE
// ============================================================
async function addDraftFiles(files) {
  if (!files || !files.length || !_fotoModalState.assetId) return;
  startSequentialUpload(files);
}

async function startSequentialUpload(files) {
  var assetId = _fotoModalState.assetId;
  var a = features.find(function(f) { return f.id === assetId; });
  if (!a) { alert('Aset tidak ditemukan'); return; }
  if (!files || !files.length) return;

  var total = files.length;
  if (!_fotoModalState.photos) _fotoModalState.photos = [];

  // Step 1: Compress & create instant permanent Base64 preview items
  var newDraftItems = [];
  for (let i = 0; i < total; i++) {
    var file = files[i];
    var tempId = 'temp_' + Date.now() + '_' + i;
    
    // Compress upfront for permanent lightweight base64 preview
    var base64 = await compressImageToBase64(file, 800);
    var previewUrl = base64 || '';

    var draftPhotoObj = {
      id: tempId,
      file: file,
      asset_id: assetId,
      base64: base64,
      previewUrl: previewUrl,
      url_foto: previewUrl,
      status: 'uploading',
      lat: '',
      lng: '',
      sumber_tag: 'proses',
      tanggal: 'Unggah Baru'
    };
    newDraftItems.push(draftPhotoObj);
  }

  // Prepend new draft items to the front of photos list
  _fotoModalState.photos = [...newDraftItems, ..._fotoModalState.photos];
  renderFotoModalBodyFromState();

  // Step 2: Upload each photo in background to server
  let successCount = 0;
  for (let i = 0; i < newDraftItems.length; i++) {
    var item = newDraftItems[i];
    var file = item.file;

    try {
      var base64 = item.base64 || await compressImageToBase64(file, 800);
      if (!base64) throw new Error('Gagal kompresi foto');

      var lat = '', lng = '', sumber_tag = 'tidak_diketahui';
      var exifInfo = await getExifData(file);
      
      if (exifInfo && exifInfo.date) {
        item.tanggal = exifInfo.date;
      }
      
      if (exifInfo && exifInfo.location) {
        lat = exifInfo.location[0]; lng = exifInfo.location[1]; sumber_tag = 'exif_foto';
      } else if (a.geomType === 'polygon' && isValidPolygonCoords(a.coords)) {
        var c = computeCentroid(a.coords);
        lat = c[0]; lng = c[1]; sumber_tag = 'centroid';
      } else {
        var gps = await getDeviceLocation();
        if (gps && isValidIndonesiaGps(gps[0], gps[1])) {
          lat = gps[0]; lng = gps[1]; sumber_tag = 'gps_hp';
        } else if (isValidPoint(a.point)) {
          lat = a.point[0]; lng = a.point[1]; sumber_tag = 'titik_aset';
        }
      }

      item.lat = lat;
      item.lng = lng;
      item.sumber_tag = sumber_tag;

      var entry = { asset_id: assetId, base64: base64, mimeType: 'image/jpeg', lat: lat, lng: lng, sumber_tag: sumber_tag };
      var res = await addPhoto(entry);

      if (res && res.ok) {
        successCount++;
        item.status = 'success';
        if (res.id) item.id = res.id;
        // Only override url_foto if res.url_foto is non-empty
        if (res.url_foto) item.url_foto = res.url_foto;
      } else {
        item.status = 'error';
      }
    } catch(err) {
      console.error('Upload item failed:', err);
      item.status = 'error';
    }

    renderFotoModalBodyFromState();
  }

  showToast('✓ ' + successCount + ' dari ' + total + ' foto berhasil diunggah');
}

// ============================================================
// LIGHTBOX
// // Lightbox functions removed.
// ============================================================

// ============================================================
// INISIALISASI event handler foto modal & lightbox (dipanggil sekali)
// ============================================================
function initFotoModal() {
  // Tutup drawer foto
  var closeBtn = document.getElementById('btnCloseFotoDrawer');
  var drawer = document.getElementById('fotoDrawer');
  function closeFotoModal() {
    if (drawer) drawer.classList.remove('open');
    _fotoModalState.assetId = null;
    _fotoModalState.photos = [];
    updateToggleButtons();
  }
  if (closeBtn) closeBtn.addEventListener('click', closeFotoModal);

  // Simple Lightbox Close Handlers
  var lbClose = document.getElementById('btnCloseSimpleLightbox');
  var lbOverlay = document.getElementById('simpleLightboxModal');
  if (lbClose) lbClose.addEventListener('click', closeSimpleLightbox);
  if (lbOverlay) lbOverlay.addEventListener('click', function(e) {
    if (e.target === lbOverlay) closeSimpleLightbox();
  });

  // Inisialisasi drawer side panel (kanan)
  var closeSideBtn = document.getElementById('btnCloseSidePanel');
  var sidePanel = document.getElementById('sidePanel');
  if (closeSideBtn) {
    closeSideBtn.addEventListener('click', function() {
      if (sidePanel) sidePanel.classList.remove('open');
      updateToggleButtons();
    });
  }

  // Floating Toggle logic
  var btnToggleLeft = document.getElementById('btnToggleLeft');
  var btnToggleRight = document.getElementById('btnToggleRight');
  if (btnToggleLeft) {
    btnToggleLeft.addEventListener('click', function() {
      if (drawer && selectedId) {
        drawer.classList.toggle('open');
        updateToggleButtons();
      }
    });
  }
  if (btnToggleRight) {
    btnToggleRight.addEventListener('click', function() {
      if (sidePanel && selectedId) {
        sidePanel.classList.toggle('open');
        updateToggleButtons();
      }
    });
  }

  // Carousel navigation
  var carouselPrev = document.getElementById('carouselPrev');
  var carouselNext = document.getElementById('carouselNext');
  if (carouselPrev) {
    carouselPrev.addEventListener('click', function() {
      if (_fotoModalState.currentIdx > 0) {
        _fotoModalState.currentIdx--;
        updateCarouselView();
      }
    });
  }
  if (carouselNext) {
    carouselNext.addEventListener('click', function() {
      if (_fotoModalState.currentIdx < (_fotoModalState.photos.length - 1)) {
        _fotoModalState.currentIdx++;
        updateCarouselView();
      }
    });
  }

  // Upload komputer (multi-file)
  var btnKomputer = document.getElementById('btnUploadKomputer');
  var inputKomputer = document.getElementById('fotoInputKomputer');
  if (btnKomputer) btnKomputer.addEventListener('click', function() { inputKomputer.click(); });
  if (inputKomputer) inputKomputer.addEventListener('change', function(e) {
    var fileList = Array.from(e.target.files || []);
    e.target.value = '';
    if (fileList.length && _fotoModalState.assetId) addDraftFiles(fileList);
  });

  // Upload kamera HP
  var inputKamera = document.getElementById('fotoInputKamera');
  if (inputKamera) inputKamera.addEventListener('change', function(e) {
    var fileList = Array.from(e.target.files || []);
    e.target.value = '';
    if (fileList.length && _fotoModalState.assetId) addDraftFiles(fileList);
  });

  // Event handlers untuk Draft Foto Area (Sudah dihapus diganti modal progress)

  // Lightbox navigasi
  var lbClose = document.getElementById('lightboxClose');
  var lbPrev = document.getElementById('lightboxPrev');
  var lbNext = document.getElementById('lightboxNext');
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbPrev) lbPrev.addEventListener('click', function() {
    if (_fotoModalState.currentIdx > 0) {
      _fotoModalState.currentIdx--;
      renderLightboxFrame();
    }
  });
  if (lbNext) lbNext.addEventListener('click', function() {
    if (_fotoModalState.currentIdx < _fotoModalState.photos.length - 1) {
      _fotoModalState.currentIdx++;
      renderLightboxFrame();
    }
  });

  // Keyboard support lightbox
  document.addEventListener('keydown', function(e) {
    var lb = document.getElementById('fotoLightbox');
    if (!lb || lb.style.display === 'none') return;
    if (e.key === 'ArrowLeft') { if (_fotoModalState.currentIdx > 0) { _fotoModalState.currentIdx--; renderLightboxFrame(); } }
    if (e.key === 'ArrowRight') { if (_fotoModalState.currentIdx < _fotoModalState.photos.length - 1) { _fotoModalState.currentIdx++; renderLightboxFrame(); } }
    if (e.key === 'Escape') closeLightbox();
  });

  // Klik luar area foto lightbox = tutup
  var lbEl = document.getElementById('fotoLightbox');
  if (lbEl) lbEl.addEventListener('click', function(e) {
    if (e.target === lbEl) closeLightbox();
  });
}

// Fungsi ini dipertahankan agar tidak breaking code lain yang mungkin memangilnya
async function loadAndRenderPhotos(assetId) {
  if (_fotoModalState.assetId === assetId) {
    await loadAndRenderFotoModal(assetId);
  }
}

async function loadAndRenderHistory(assetId) {
  const container = document.getElementById('historyList');
  if (!container) return;
  const history = await fetchHistory(assetId);
  const stillOpen = document.getElementById('historyList');
  if (!stillOpen) return;
  if (!history.length) {
    stillOpen.innerHTML = '<p class="small-note" style="margin:0;">Belum ada riwayat dokumen.</p>';
    return;
  }
  const sorted = history.slice().sort((x, y) => new Date(x.tanggal) - new Date(y.tanggal));
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

  if (isAdmin()) {
    stillOpen.querySelectorAll('.btnDeleteHistory').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Hapus entri riwayat ini?')) {
          const ok = await deleteHistoryEntry(btn.dataset.id);
          if (ok) loadAndRenderHistory(assetId);
        }
      });
    });
  }
}

function renderEditPanel(a) {
  const geojsonBox = `
    <div class="field" style="background:#F7F9FA;border:1px dashed var(--border);border-radius:6px;padding:10px;">
      <label style="margin-bottom:6px;">${a.geomType === "point" ? "Sudah ada hasil trace GeoJSON untuk aset ini? Tempel di sini:" : "Mau ganti bentuk poligon? Tempel GeoJSON baru di sini:"}</label>
      <textarea id="f-geojson" rows="4" placeholder='{"type":"Feature","geometry":{"type":"Polygon","coordinates":[...]}}'></textarea>
      <div class="actions-row" style="margin-top:8px;">
        <button id="btnApplyGeojson" class="primary" style="font-size:12px;opacity:0.45;cursor:not-allowed;" disabled>Terapkan sebagai poligon</button>
      </div>
    </div>
  `;

  const geomSection = a.geomType === "point" ? `
    <div class="row2">
      <div class="field"><label>Latitude</label><input type="number" step="0.000001" id="f-lat" value="${isValidPoint(a.point) ? a.point[0] : ''}" placeholder="mis. -8.650000"></div>
      <div class="field"><label>Longitude</label><input type="number" step="0.000001" id="f-lng" value="${isValidPoint(a.point) ? a.point[1] : ''}" placeholder="mis. 115.220000"></div>
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

  const currentAsal = getNormalizedAsalAset(a.props.asal_aset);
  const panel = document.getElementById('sidePanel');
  panel.innerHTML = `
    <h3>Edit aset ${a.geomType === "point" ? '<span class="badge" style="background:#6B7280;">titik</span>' : '<span class="badge" style="background:#4C8C3F;">poligon</span>'}</h3>
    <div class="field"><label>Kode aset</label><input type="text" id="f-kode_aset" value="${escapeHtml(a.props.kode_aset || "")}"></div>
    <div class="field"><label>Asal aset</label>
      <select id="f-asal_aset">
        ${ASAL_ASET_OPTIONS.map(o => `<option value="${o}" ${o === currentAsal ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Lokasi</label><input type="text" id="f-lokasi" value="${escapeHtml(a.props.lokasi || "")}"></div>
    <div class="field"><label>Kluster Aset</label>
      <input type="text" id="f-kluster" value="${escapeHtml(getClusterValue(a.props))}" list="kluster-list" placeholder="mis. Kluster Kesiman, Kluster Sanur, dll.">
      <datalist id="kluster-list">
        ${getUniqueClusters().map(c => `<option value="${escapeHtml(c)}">`).join('')}
      </datalist>
    </div>
    <div class="row2">
      <div class="field"><label>Luas tanah (m²)</label><input type="number" id="f-luas_tanah" value="${getLuasTanah(a.props)}"></div>
      <div class="field"><label>Luas bangunan (m²)</label><input type="number" id="f-luas_bangunan" value="${getLuasBangunan(a.props)}"></div>
    </div>
    <div class="field"><label>Status</label>
      <select id="f-status">
        ${STATUS_OPTIONS.map(s => `<option value="${s}" ${s === a.props.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="field" id="wrap-kategori" style="display:none;">
      <label>Kategori</label>
      <select id="f-kategori_penitipan">
        ${KATEGORI_OPTIONS.map(k => `<option value="${k}" ${k === a.props.kategori_penitipan ? 'selected' : ''}>${k}</option>`).join('')}
      </select>
    </div>
    <div class="field" id="wrap-keterangan_kategori" style="display:none;">
      <label>Keterangan kategori (wajib diisi untuk "Lain-lain")</label>
      <input type="text" id="f-keterangan_kategori" value="${escapeHtml(a.props.keterangan_kategori || '')}" placeholder="mis. Sedang berperkara, disita, dll.">
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
      <div class="field"><label>No. Dokumen </label><input type="text" id="f-no_dokumen" value="${escapeHtml(a.props.no_dokumen || "")}"></div>
      <div class="field"><label>Jenis dokumen</label><input type="text" id="f-jenis_dokumen" value="${escapeHtml(a.props.jenis_dokumen || "")}"></div>
    </div>
    <div class="field"><label>Catatan</label><textarea id="f-catatan" rows="3">${escapeHtml(a.props.catatan || "")}</textarea></div>
    <div class="field"><label>Link folder berkas (OneDrive / Drive)</label><input type="text" id="f-link_folder" value="${escapeHtml(a.props.link_folder || "")}"></div>
    ${geomSection}
    ${extraSection}
    <div class="actions-row">
      <button class="primary" id="btnSave">Simpan</button>
      <button id="btnCancelEdit">Batal</button>
    </div>
  `;

  function updateConditionalFields() {
    const status = document.getElementById('f-status').value;
    const wrapKategori = document.getElementById('wrap-kategori');
    const wrapKeterangan = document.getElementById('wrap-keterangan_kategori');
    wrapKategori.style.display = status === "Dalam Penitipan" ? '' : 'none';
    const kategori = document.getElementById('f-kategori_penitipan').value;
    wrapKeterangan.style.display = (status === "Dalam Penitipan" && kategori === "Lain-lain") ? '' : 'none';
  }
  updateConditionalFields();
  document.getElementById('f-status').addEventListener('change', updateConditionalFields);
  document.getElementById('f-kategori_penitipan').addEventListener('change', updateConditionalFields);

  document.getElementById('btnSave').addEventListener('click', () => {
    a.props.kode_aset = document.getElementById('f-kode_aset').value;
    a.props.asal_aset = document.getElementById('f-asal_aset').value;
    a.props.lokasi = document.getElementById('f-lokasi').value;
    const klusterVal = document.getElementById('f-kluster').value.trim();
    // Sync all possible cluster key variants so backend finds the right one
    ['kluster', 'Kluster', 'kluster_aset', 'Kluster Aset', 'cluster', 'Cluster', 'cluster_aset', 'Cluster Aset'].forEach(function (k) {
      if (a.props[k] !== undefined) a.props[k] = klusterVal;
    });
    a.props.kluster = klusterVal; // always set canonical key
    a.props.luas_tanah = Number(document.getElementById('f-luas_tanah').value) || 0;
    a.props.luas_bangunan = Number(document.getElementById('f-luas_bangunan').value) || 0;
    a.props.luas = a.props.luas_tanah;
    a.props.status = document.getElementById('f-status').value;
    a.props.kategori_penitipan = a.props.status === "Dalam Penitipan" ? document.getElementById('f-kategori_penitipan').value : "";
    a.props.keterangan_kategori = (a.props.status === "Dalam Penitipan" && a.props.kategori_penitipan === "Lain-lain") ? document.getElementById('f-keterangan_kategori').value : "";
    a.props.jenis_pemanfaatan = "";
    a.props.alasan_selesai_penitipan = "";
    a.props.no_dokumen = document.getElementById('f-no_dokumen').value;
    a.props.jenis_dokumen = document.getElementById('f-jenis_dokumen').value;
    a.props.catatan = document.getElementById('f-catatan').value;
    a.props.link_folder = document.getElementById('f-link_folder').value;
    document.querySelectorAll('.f-extra').forEach(inp => { a.props[inp.dataset.key] = inp.value; });
    if (a.geomType === "point") {
      const latInput = document.getElementById('f-lat');
      const lngInput = document.getElementById('f-lng');
      if (latInput && lngInput) {
        const latRaw = latInput.value.trim();
        const lngRaw = lngInput.value.trim();
        if (latRaw !== '' && lngRaw !== '') {
          const lat = Number(latRaw);
          const lng = Number(lngRaw);
          if (!isNaN(lat) && !isNaN(lng)) {
            a.point = [lat, lng];
          } else {
            a.point = [0, 0];
          }
        } else {
          a.point = [0, 0];
        }
      }
    }
    renderAll();
    selectAsset(a.id, 'view');
    persistAsset(a);
  });
  document.getElementById('btnCancelEdit').addEventListener('click', () => {
    selectAsset(a.id, 'view');
  });

  const btnApply = document.getElementById('btnApplyGeojson');
  const geojsonInput = document.getElementById('f-geojson');
  if (btnApply && geojsonInput) {
    const updateBtnState = () => {
      const hasText = !!geojsonInput.value.trim();
      btnApply.disabled = !hasText;
      btnApply.style.opacity = hasText ? '1' : '0.45';
      btnApply.style.cursor = hasText ? 'pointer' : 'not-allowed';
    };
    updateBtnState();
    geojsonInput.addEventListener('input', updateBtnState);
  }

  document.getElementById('btnApplyGeojson').addEventListener('click', () => {
    const raw = document.getElementById('f-geojson').value.trim();
    if (!raw) return;
    try {
      const gj = JSON.parse(raw);
      let feature = null;
      let geom;
      if (gj.type === "FeatureCollection") {
        if (!gj.features || !gj.features.length) {
          alert("FeatureCollection tidak berisi feature apa pun.");
          return;
        }
        feature = gj.features[0];
        geom = feature.geometry;
      } else if (gj.type === "Feature") {
        feature = gj;
        geom = gj.geometry;
      } else {
        geom = gj;
      }
      let coords = [];
      if (geom.type === "Polygon") {
        coords = geom.coordinates[0].map(c => [c[1], c[0]]);
      } else if (geom.type === "MultiPolygon") {
        coords = geom.coordinates[0][0].map(c => [c[1], c[0]]);
      } else if (geom.type === "LineString" || geom.type === "MultiLineString") {
        let line = geom.type === "MultiLineString" ? geom.coordinates[0] : geom.coordinates;
        line = line.slice();
        const first = line[0], last = line[line.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          line.push(first);
        }
        coords = line.map(c => [c[1], c[0]]);
      } else {
        alert("Geometri harus berupa Polygon, MultiPolygon, LineString, atau MultiLineString.");
        return;
      }
      a.geomType = "polygon";
      a.coords = coords;
      delete a.point;
      if (feature && feature.properties) {
        const p = feature.properties;
        if (p.luas_tanah || p.luas || p.area) {
          a.props.luas_tanah = p.luas_tanah || p.luas || p.area;
          a.props.luas = a.props.luas_tanah;
        }
        if (p.luas_bangunan) a.props.luas_bangunan = p.luas_bangunan;
      }
      renderAll();
      selectAsset(a.id, 'edit');
      persistAsset(a);
    } catch (e) {
      alert("GeoJSON tidak valid: " + e.message);
    }
  });
}

function renderUserBadge() {
  const session = getSession();
  const userInfo = document.getElementById('userInfo');
  const btnLogout = document.getElementById('btnLogout');
  if (!session) {
    if (userInfo) userInfo.textContent = '';
    if (btnLogout) btnLogout.style.display = 'none';
    return;
  }
  if (userInfo) userInfo.textContent = "Halo, " + (session.nama || session.username) + "! (" + (session.role === ROLES.ADMIN ? "admin" : "viewer") + ")";
  if (btnLogout) btnLogout.style.display = 'inline-block';
}

function applyRoleUI() {
  const admin = isAdmin();
  const addBtn = document.getElementById('btnAddPoint');
  if (addBtn) addBtn.style.display = admin ? '' : 'none';
  if (btnDraw) btnDraw.style.display = admin ? '' : 'none';
  const hint = document.getElementById('hintTambahAset');
  if (hint) hint.style.display = admin ? '' : 'none';
  const exportBtn = document.getElementById('btnExportSheets');
  if (exportBtn) exportBtn.style.display = admin ? '' : 'none';
}

const btnExportSheets = document.getElementById('btnExportSheets');
if (btnExportSheets) {
  btnExportSheets.addEventListener('click', async () => {
    if (!isAdmin()) return;
    if (!confirm('Unduh data (Aset & Riwayat) sebagai file Excel?')) return;
    await exportToExcel();
  });
}

const btnBurger = document.getElementById('btnBurger');
if (btnBurger) {
  btnBurger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('headerActions').classList.toggle('open');
  });
}
document.addEventListener('click', (e) => {
  const actions = document.getElementById('headerActions');
  const burger = document.getElementById('btnBurger');
  if (actions && actions.classList.contains('open') && !actions.contains(e.target) && e.target !== burger) {
    actions.classList.remove('open');
  }
});
const headerActions = document.getElementById('headerActions');
if (headerActions) {
  headerActions.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') document.getElementById('headerActions').classList.remove('open');
  });
}

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    clearSession();
    sessionStorage.removeItem('bppn_disclaimer_agreed');
    window.location.href = 'login.html';
  });
}

// Modal Persetujuan Akses Data
// Mengembalikan Promise yang resolve saat user klik Setuju.
// loadFromServer() baru dipanggil setelah promise ini resolve.
function showAgreementModal() {
  return new Promise(function(resolve) {
    if (sessionStorage.getItem('bppn_disclaimer_agreed') === 'true') {
      return resolve();
    }
    
    var overlay = document.getElementById('agreementOverlay');
    var btnAgree = document.getElementById('btnAgree');
    var btnDisagree = document.getElementById('btnDisagree');

    if (!overlay) {
      console.warn('[AgreementModal] Elemen #agreementOverlay tidak ditemukan, langsung lanjut.');
      resolve();
      return;
    }

    // Tampilkan via inline style — bypass semua CSS/cache issue
    overlay.style.display = 'flex';

    if (btnAgree) {
      btnAgree.onclick = function() {
        sessionStorage.setItem('bppn_disclaimer_agreed', 'true');
        overlay.style.display = 'none';
        resolve();
      };
    } else {
      console.warn('[AgreementModal] btnAgree tidak ditemukan');
      resolve();
    }

    if (btnDisagree) {
      btnDisagree.onclick = function() {
        clearSession();
        window.location.href = 'login.html';
      };
    }
  });
}

const btnRefresh = document.getElementById('btnRefresh');
if (btnRefresh) {
  btnRefresh.addEventListener('click', () => {
    loadFromServer();
  });
}

// Event listeners for Table Tabs
const tabKlusterEl = document.getElementById('tabKluster');
if (tabKlusterEl) tabKlusterEl.addEventListener('click', () => switchTab('kluster'));
const tabSemuaEl = document.getElementById('tabSemua');
if (tabSemuaEl) tabSemuaEl.addEventListener('click', () => switchTab('semua'));

// Event listeners for Interactive Stat Cards
const cardTotalAsetEl = document.getElementById('cardTotalAset');
if (cardTotalAsetEl) cardTotalAsetEl.addEventListener('click', () => { specialFilter = null; const sel = document.getElementById('filterStatus'); if (sel) sel.value = 'all'; switchTab('semua'); renderAll(); smoothScrollToTable(); });

const cardTotalKlusterEl = document.getElementById('cardTotalKluster');
if (cardTotalKlusterEl) cardTotalKlusterEl.addEventListener('click', () => { switchTab('kluster'); smoothScrollToTable(); });

const cardSudahEl = document.getElementById('cardSudahDimanfaatkan');
if (cardSudahEl) cardSudahEl.addEventListener('click', () => { specialFilter = null; const sel = document.getElementById('filterStatus'); if (sel) sel.value = 'Sudah Dimanfaatkan'; switchTab('semua'); renderAll(); smoothScrollToTable(); });

const cardBelumEl = document.getElementById('cardBelumDimanfaatkan');
if (cardBelumEl) cardBelumEl.addEventListener('click', () => { specialFilter = null; const sel = document.getElementById('filterStatus'); if (sel) sel.value = 'Belum Dimanfaatkan'; switchTab('semua'); renderAll(); smoothScrollToTable(); });

const cardBermasalahEl = document.getElementById('cardBermasalah');
if (cardBermasalahEl) cardBermasalahEl.addEventListener('click', () => { specialFilter = null; const sel = document.getElementById('filterStatus'); if (sel) sel.value = 'Bermasalah Hukum'; switchTab('semua'); renderAll(); smoothScrollToTable(); });

const cardBerakhirEl = document.getElementById('cardBerakhir');
if (cardBerakhirEl) cardBerakhirEl.addEventListener('click', () => { specialFilter = null; const sel = document.getElementById('filterStatus'); if (sel) sel.value = 'Lain-lain'; switchTab('semua'); renderAll(); smoothScrollToTable(); });

const cardBelumCoordEl = document.getElementById('cardBelumKoordinat');
if (cardBelumCoordEl) cardBelumCoordEl.addEventListener('click', () => { specialFilter = 'no_coord'; switchTab('semua'); renderAll(); smoothScrollToTable(); });

const cardBatasBelumEl = document.getElementById('cardBatasBelumDitemukan');
if (cardBatasBelumEl) cardBatasBelumEl.addEventListener('click', () => { specialFilter = 'no_poly'; switchTab('semua'); renderAll(); smoothScrollToTable(); });

// Inisialisasi awal aplikasi
initFotoModal();
renderUserBadge();
applyRoleUI();
switchTab('kluster');
renderAll();

// Tampilkan modal persetujuan dulu, baru muat data dari server
showAgreementModal().then(function() {
  loadFromServer();
});