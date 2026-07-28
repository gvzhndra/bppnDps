// ================= KONFIGURASI =================
// Ganti dengan URL Web App hasil deploy Apps Script kamu (lihat Code.gs)
const API_URL = "https://script.google.com/macros/s/AKfycbwQmsq806xBoepakiGemP097w_DSsVgCd8S87KBZ_M23aiWnLp24o7VbqP5JT0NKJ6r/exec";
// =================================================

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
