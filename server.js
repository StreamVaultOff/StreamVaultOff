const ADMIN_PASS = 'password';
const API_BASE = 'http://localhost:3000';

let adminUnlocked = false;
let allAdminFilms = [];
let pendingFile = null;

/* ── utils ── */
const esc = s => String(s)
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;');

const fmtDt = ts =>
  new Date(ts).toLocaleDateString('en-GB',{
    day:'numeric',
    month:'short',
    year:'numeric'
  });

let _tt;

function toast(msg, type='ok'){
  const e = document.getElementById('toast');
  e.textContent = msg;
  e.className = 'toast '+type;

  void e.offsetWidth;
  e.classList.add('show');

  clearTimeout(_tt);
  _tt = setTimeout(()=>e.classList.remove('show'), 3200);
}

/* ── overlays ── */
function op(id){ document.getElementById(id).classList.add('open') }
function cl(id){ document.getElementById(id).classList.remove('open') }

document.querySelectorAll('.overlay').forEach(el =>
  el.addEventListener('click', e => {
    if(e.target !== el) return;
    if(el.id === 'vidOv') clVid(); else cl(el.id);
  })
);

function goLib(e){
  e.preventDefault();
  document.getElementById('libSec')
    .scrollIntoView({behavior:'smooth'});
}

/* ── tabs ── */
function tab(t){
  ['up','mg'].forEach(n => {
    document.getElementById('tp-'+n)
      .classList.toggle('active', n===t);

    document.getElementById('tab'+(n==='up'?'Up':'Mg')+'Btn')
      .classList.toggle('active', n===t);
  });

  if(t === 'mg') loadAdminFilms();
}

/* ── load library ── */
async function loadLibrary(){
  try {
    const films =
      await fetch(API_BASE + '/api/films')
        .then(r=>r.json());

    const row = document.getElementById('filmRow');

    if(!Array.isArray(films) || !films.length){
      row.innerHTML =
        '<div class="empty-lib"><div style="font-size:2.5rem">🎬</div><p>No films yet — an admin can upload some above.</p></div>';
      return;
    }

    row.innerHTML = films.map(f => `
      <div class="film-card" onclick="play(${JSON.stringify(f.streamUrl)}, ${JSON.stringify(f.title)})">
        <div class="thumb">
          <span>MP4</span>
        </div>

        <div class="film-info">
          <div class="ftitle">${esc(f.title)}</div>
          <div class="fmeta">${f.size}</div>
        </div>
      </div>
    `).join('');

  } catch(e){
    document.getElementById('filmRow').innerHTML =
      '<div class="empty-lib"><p style="color:var(--accent)">Could not connect to server.</p></div>';
  }
}

/* ── admin list ── */
async function loadAdminFilms(){
  try {
    const films =
      await fetch(API_BASE + '/api/films')
        .then(r=>r.json());

    allAdminFilms = Array.isArray(films) ? films : [];
    filterMg();

  } catch {
    toast('Could not load films','err');
  }
}

/* ── filter ── */
function filterMg(){
  const q =
    (document.getElementById('srch').value||'')
      .toLowerCase();

  const res =
    allAdminFilms.filter(f =>
      !q || f.title.toLowerCase().includes(q)
    );

  document.getElementById('mcount').textContent =
    res.length + ' film' + (res.length!==1?'s':'') +
    (q?' matching':'');

  const list = document.getElementById('mlist');

  if(!res.length){
    list.innerHTML =
      '<div class="nofilm">No films match your search.</div>';
    return;
  }

  list.innerHTML = res.map(f => `
    <div class="mitem">
      <div class="mico">🎬</div>

      <div class="minf">
        <div class="mname">${esc(f.title)}</div>
        <div class="mmeta">${f.size}</div>
      </div>

      <div class="macts">
        <button class="act"
          onclick="play(${JSON.stringify(f.streamUrl)}, ${JSON.stringify(f.title)})">
          ▶ Play
        </button>

        <button class="act del"
          onclick="delFilm(${JSON.stringify(f.id)}, ${JSON.stringify(f.title)})">
          Delete
        </button>
      </div>
    </div>
  `).join('');
}

/* ── password ── */
document.getElementById('adminBtn').onclick = () => {
  if(adminUnlocked){
    tab('up');
    op('adminOv');
    return;
  }

  document.getElementById('pwInp').value='';
  document.getElementById('pwErr').style.display='none';
  document.getElementById('pwInp').classList.remove('shake');

  op('pwOv');
  setTimeout(()=>document.getElementById('pwInp').focus(), 150);
};

function submitPw(){
  const v =
    document.getElementById('pwInp').value;

  if(v === ADMIN_PASS){
    adminUnlocked = true;
    cl('pwOv');
    tab('up');
    op('adminOv');
  } else {
    const el = document.getElementById('pwInp');
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    document.getElementById('pwErr').style.display='block';
  }
}

document.getElementById('pwBtn').onclick = submitPw;

document.getElementById('pwInp')
  .addEventListener('keydown', e=>{
    if(e.key==='Enter') submitPw();
  });

/* ── upload ── */
const dz = document.getElementById('dz');
const fi = document.getElementById('fi');

dz.addEventListener('click', ()=>fi.click());

dz.addEventListener('dragenter', e=>{
  e.preventDefault();
  dz.classList.add('over');
});

dz.addEventListener('dragover', e=>{
  e.preventDefault();
  dz.classList.add('over');
});

dz.addEventListener('dragleave', e=>{
  if(!dz.contains(e.relatedTarget))
    dz.classList.remove('over');
});

dz.addEventListener('drop', e=>{
  e.preventDefault();
  dz.classList.remove('over');

  const f = e.dataTransfer.files[0];

  if(f){
    if(!f.type.startsWith('video/')){
      toast('Please drop a video file','err');
      return;
    }
    setFile(f);
  }
});

fi.addEventListener('change', function(){
  if(this.files[0]) setFile(this.files[0]);
  this.value='';
});

function setFile(f){
  pendingFile = f;

  document.getElementById('fchosen').textContent =
    '✓ ' + f.name;

  const t = document.getElementById('ftitle');

  if(!t.value){
    t.value = f.name
      .replace(/\.[^.]+$/,'')
      .replace(/[-_]+/g,' ');
  }
}

/* ── upload send ── */
document.getElementById('upBtn').onclick = () => {
  if(!pendingFile){
    toast('Select a file first','err');
    return;
  }

  const title =
    document.getElementById('ftitle').value.trim()
    || pendingFile.name.replace(/\.[^.]+$/,'');

  const pw =
    document.getElementById('upProg');

  const fill = document.getElementById('upFill');
  const lbl = document.getElementById('upLbl');

  pw.style.display='block';
  fill.style.width='0%';
  lbl.textContent='Uploading…';

  document.getElementById('upBtn').disabled=true;

  const fd = new FormData();
  fd.append('video', pendingFile);
  fd.append('title', title);

  const xhr = new XMLHttpRequest();

  xhr.open('POST', API_BASE + '/api/films');

  xhr.setRequestHeader('x-admin-password', ADMIN_PASS);

  xhr.upload.onprogress = e => {
    if(e.lengthComputable){
      const p = Math.round(e.loaded/e.total*100);
      fill.style.width = p+'%';
      lbl.textContent = 'Uploading… '+p+'%';
    }
  };

  xhr.onload = () => {
    const r = JSON.parse(xhr.responseText);

    if(xhr.status === 201){
      fill.style.width='100%';
      lbl.textContent='Done!';

      pendingFile=null;
      document.getElementById('fchosen').textContent='';
      document.getElementById('ftitle').value='';

      setTimeout(()=>{
        pw.style.display='none';
        fill.style.width='0%';
      }, 1000);

      document.getElementById('upBtn').disabled=false;

      toast('"'+title+'" uploaded','ok');

      loadLibrary();

    } else {
      toast(r.error || 'Upload failed','err');
      pw.style.display='none';
      document.getElementById('upBtn').disabled=false;
    }
  };

  xhr.onerror = () => {
    toast('Server not reachable','err');
    pw.style.display='none';
    document.getElementById('upBtn').disabled=false;
  };

  xhr.send(fd);
};

/* ── delete ── */
async function delFilm(id, title){
  if(!confirm('Delete "'+title+'"?')) return;

  const r = await fetch(API_BASE + '/api/films/' + id, {
    method:'DELETE',
    headers:{
      'x-admin-password': ADMIN_PASS
    }
  });

  if(r.status===204){
    toast('"'+title+'" deleted','err');
    loadLibrary();
    loadAdminFilms();
  } else {
    const j = await r.json();
    toast(j.error||'Delete failed','err');
  }
}

/* ── play ── */
function play(url, title){
  document.getElementById('vtitle').textContent = title;
  const v = document.getElementById('vid');
  v.src = url;
  op('vidOv');
  v.play();
}

function clVid(){
  const v = document.getElementById('vid');
  v.pause();
  v.src='';
  cl('vidOv');
}

/* ── boot ── */
loadLibrary();
