// ================= KONFIGURASI =================
// Ganti dengan URL Web App hasil deploy Apps Script kamu (lihat Code.gs)
const API_URL = "https://script.google.com/macros/s/AKfycbz_RG7cDsnaTIR-dT4YpiOpcHZFuB5BFGh10E4fS4CyOLSF9YT8uYEyQMipm54J64c0cQ/exec";
// =================================================

const statusColor = {
  "Dalam Penitipan":"#4C8C3F",
  "Penitipan Berakhir":"#B8790F",
  "Pemanfaatan":"#1F78B4",
  "Bermasalah hukum":"#B23A3A"
};

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

const CORE_PROPS = [
    "kode_aset",
    "lokasi",
    "status",
    "luas",
    "no_dokumen",
    "jenis_dokumen",
    "catatan"
];
