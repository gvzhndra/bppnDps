// ================= KONFIGURASI =================
// Ganti dengan URL Web App hasil deploy Apps Script kamu (lihat Code.gs)
//const API_URL = "https://script.google.com/macros/s/AKfycbz_RG7cDsnaTIR-dT4YpiOpcHZFuB5BFGh10E4fS4CyOLSF9YT8uYEyQMipm54J64c0cQ/exec";
const API_URL = "https://script.google.com/macros/s/AKfycbwQmsq806xBoepakiGemP097w_DSsVgCd8S87KBZ_M23aiWnLp24o7VbqP5JT0NKJ6r/exec";

// =================================================

// Warna badge untuk status utama
const statusColor = {
  "Dalam Penitipan":"#4C8C3F",
  "Penitipan Berakhir":"#B8790F"
};

// Warna badge untuk kategori tambahan (cuma relevan kalau status = Dalam Penitipan)
const kategoriColor = {
  "Belum Dimanfaatkan":"#94A3B8",
  "Pemanfaatan":"#1F78B4",
  "Bermasalah Hukum":"#B23A3A"
};

const STATUS_OPTIONS = ["Dalam Penitipan", "Penitipan Berakhir"];
const KATEGORI_OPTIONS = ["Belum Dimanfaatkan", "Pemanfaatan", "Bermasalah Hukum"];

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

// Field yang punya perlakuan/form khusus di UI (bukan field custom generik)
const CORE_PROPS = [
    "kode_aset",
    "lokasi",
    "status",
    "kategori_penitipan",
    "jenis_pemanfaatan",
    "alasan_selesai_penitipan",
    "luas",
    "no_dokumen",
    "jenis_dokumen",
    "catatan",
    "link_folder"
];
