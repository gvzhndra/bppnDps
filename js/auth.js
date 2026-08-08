// ============================
// Sesi login (disimpan di localStorage, dipakai bersama oleh index.html & login.html)
// ============================
function getSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e){ return null; }
}
function saveSession(session){
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
function clearSession(){
  localStorage.removeItem(SESSION_KEY);
}
function getToken(){
  const s = getSession();
  return s ? s.token : null;
}
function isAdmin(){
  const s = getSession();
  return !!s && s.role === ROLES.ADMIN;
}
function isSessionError(errMsg){
  const s = String(errMsg || "").toLowerCase();
  if (s.indexOf("koneksi ke apps script") !== -1 || 
      s.indexOf("google drive") !== -1 || 
      s.indexOf("respon server") !== -1 || 
      s.indexOf("halaman tidak ditemukan") !== -1 || 
      s.indexOf("<!doctype") !== -1 || 
      s.indexOf("<html") !== -1) {
    return false;
  }
  return s.indexOf("sesi") !== -1 || s.indexOf("login") !== -1 || s.indexOf("akses ditolak") !== -1;
}

async function loginRequest(username, password){
  try{
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "login", username, password })
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch(e) {
      // Fallback ke GET jika POST mengembalikan HTML (isu CORS/Redirect Apps Script)
      const params = new URLSearchParams({ action: "login", username: username, password: password, _t: Date.now() });
      const getRes = await fetch(API_URL + "?" + params.toString());
      return await getRes.json();
    }
  } catch(err){
    try {
      const params = new URLSearchParams({ action: "login", username: username, password: password, _t: Date.now() });
      const getRes = await fetch(API_URL + "?" + params.toString());
      return await getRes.json();
    } catch(getErr) {
      return { ok:false, error: "Tidak bisa terhubung ke server: " + err };
    }
  }
}

// Panggil sesegera mungkin di index.html (sebelum Leaflet dimuat): kalau belum
// ada sesi tersimpan, langsung lempar ke halaman login.
function guardDashboardPage(){
  const session = getSession();
  if(!session || !session.token){
    window.location.replace('login.html');
  }
}

// Panggil di login.html: kalau sudah ada sesi tersimpan, langsung lempar ke
// dashboard. loadFromServer() di index.html tetap akan memvalidasi ulang ke
// server, jadi token yang sudah kedaluwarsa akan otomatis dilempar balik ke sini.
function redirectIfLoggedIn(){
  const session = getSession();
  if(session && session.token){
    window.location.replace('index.html');
  }
}

// Dipanggil dari api.js saat server bilang sesi tidak valid/kedaluwarsa/ditolak.
function handleSessionExpired(){
  clearSession();
  window.location.replace('login.html?expired=1');
}
