// Kalau datang ke halaman ini karena sesi habis (dilempar oleh handleSessionExpired
// di js/auth.js), tampilkan pesannya.
(function showExpiredMessageIfAny(){
  const params = new URLSearchParams(window.location.search);
  if(params.get('expired') === '1'){
    const errEl = document.getElementById('loginError');
    errEl.textContent = "Sesi berakhir, silakan masuk kembali.";
    errEl.style.display = 'block';
  }
})();

async function doLogin(){
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  if(!username || !password){
    errEl.textContent = "Username dan password wajib diisi.";
    errEl.style.display = 'block';
    return;
  }
  const btn = document.getElementById('btnLogin');
  btn.disabled = true;
  btn.textContent = "Memproses...";
  const res = await loginRequest(username, password);
  btn.disabled = false;
  btn.textContent = "Masuk";
  if(!res.ok){
    errEl.textContent = res.error || "Username atau password salah.";
    errEl.style.display = 'block';
    return;
  }
  saveSession({ token: res.token, username: res.username, role: res.role, nama: res.nama });
  window.location.href = 'index.html';
}

document.getElementById('btnLogin').addEventListener('click', doLogin);
document.getElementById('loginPassword').addEventListener('keydown', (e) => { if(e.key === 'Enter') doLogin(); });
document.getElementById('loginUsername').addEventListener('keydown', (e) => { if(e.key === 'Enter') doLogin(); });
