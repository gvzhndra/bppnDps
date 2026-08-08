// ================= KONFIGURASI =================
// Ganti dengan URL Web App hasil deploy Apps Script kamu (lihat Code.gs)
const API_URL = "https://script.google.com/macros/s/AKfycbxknDGyfi-ZhF5kA6g52a4pJM30lzexMdL9OdPM2xMLdYfhUvwOMkYZPNr_P8OaDgi_/exec";
// =================================================

// Konfigurasi Basemap Peta (Pastel Voyager, Standar OSM, Satelit Esri)
const TILE_LAYERS = {
  PASTEL: {
    name: "Pastel",
    icon: "🗺️",
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  STREETS: {
    name: "Standar",
    icon: "🛣️",
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  SATELLITE: {
    name: "Satelit",
    icon: "🛰️",
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  }
};


// Warna badge untuk status utama
const statusColor = {
  "Dalam Penitipan": "#4C8C3F"
};

const kategoriColor = {
  "Sudah Dimanfaatkan": "#1D9E75",
  "Belum Dimanfaatkan": "#94A3B8",
  "Bermasalah Hukum": "#B23A3A",
  "Lain-lain": "#7C3AED"
};

const STATUS_OPTIONS = ["Dalam Penitipan"];
const KATEGORI_OPTIONS = ["Sudah Dimanfaatkan", "Belum Dimanfaatkan", "Bermasalah Hukum", "Lain-lain"];
const ASAL_ASET_OPTIONS = ["Eks BPPN", "Eks PT PPA"];

const RESERVED_COLUMNS = [
  "id",
  "geom_type",
  "geometry_json"
];

const ROLES = { ADMIN: "admin", VIEWER: "viewer" };
const SESSION_KEY = "aset_bppn_session";

let features = [];
let selectedId = null;
let leafletLayers = {};
let sheetHeaders = [];
let currentPage = 1;
const TABLE_PAGE_SIZE = 20;

// Field yang punya perlakuan/form khusus di UI (bukan field custom generik)
const CORE_PROPS = [
  "kode_aset",
  "asal_aset",
  "lokasi",
  "kluster",
  "status",
  "kategori_penitipan",
  "keterangan_kategori",
  "jenis_pemanfaatan",
  "alasan_selesai_penitipan",
  "luas",
  "luas_tanah",
  "luas_bangunan",
  "no_dokumen",
  "jenis_dokumen",
  "catatan",
  "link_folder"
];
