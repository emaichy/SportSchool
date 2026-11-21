// ---------- IndexedDB ----------
let db;
const open=()=>new Promise((ok,ko)=>{
  const r=indexedDB.open('sportschool',2);
  r.onupgradeneeded=()=>{const d=r.result,n=d.objectStoreNames;
    if(!n.contains('estudiantes'))d.createObjectStore('estudiantes',{keyPath:'id',autoIncrement:true});
    if(!n.contains('actividades'))d.createObjectStore('actividades',{keyPath:'id',autoIncrement:true}).createIndex('est','estudianteId');
    if(!n.contains('catalogo'))d.createObjectStore('catalogo',{keyPath:'id',autoIncrement:true});};
  r.onsuccess=()=>{db=r.result;ok()};r.onerror=()=>ko(r.error);
});
const tx=(s,m,fn)=>new Promise((ok,ko)=>{const t=db.transaction(s,m),q=fn(t.objectStore(s));t.oncomplete=()=>ok(q.result);t.onerror=()=>ko(t.error);});
const add=(s,o)=>tx(s,'readwrite',x=>x.add(o));
const put=(s,o)=>tx(s,'readwrite',x=>x.put(o));
const del=(s,k)=>tx(s,'readwrite',x=>x.delete(k));
const all=s=>tx(s,'readonly',x=>x.getAll());
// ---------- Utilidades ----------
const $=s=>document.querySelector(s);
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ests=[],acts=[],cat=[],pos=null;
const stat=(n,l)=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`;
const calc=l=>({n:l.length,min:l.reduce((a,x)=>a+x.min,0),km:l.reduce((a,x)=>a+x.km,0)});
// ---------- Render (CSR) ----------
function render(){
  const opts=ests.length?ests.map(e=>`<option value="${e.id}">${esc(e.nombre)} (${esc(e.grupo)})</option>`).join(''):'<option value="">Registra un estudiante primero</option>';
  ['#selEst','#selHist','#selDes'].forEach(s=>{const el=$(s),v=el.value;el.innerHTML=opts;if(v)el.value=v;});
  const sc=$('#selCat'),cv=sc.value;
  sc.innerHTML=cat.map(c=>`<option>${esc(c.nombre)}</option>`).join('')||'<option value="">Crea una actividad primero</option>';if(cv)sc.value=cv;
  $('#listCat').innerHTML=cat.map(c=>`<li><div><b>${esc(c.nombre)}</b><small>${esc(c.desc)}</small></div><span><button class="mini" data-use="${esc(c.nombre)}"></button><button class="mini ghost" data-del="${c.id}" aria-label="Eliminar">✕</button></span></li>`).join('')||'<li class="muted">No hay actividades. Crea la primera.</li>';
  $('#listEst').innerHTML=ests.map(e=>`<li><b>${esc(e.nombre)}</b> · ${esc(e.grupo)} · ${esc(e.disciplina)}</li>`).join('')||'<li class="muted">Aún no hay estudiantes.</li>';
  const pend=acts.filter(a=>!a.synced).length;
  $('#pendTxt').textContent=pend?`Pendientes por sincronizar: ${pend}`:'Todo sincronizado.';
  const t=calc(acts);
  $('#statsHome').innerHTML=stat(ests.length,'estudiantes')+stat(t.n,'actividades')+stat(t.min,'minutos totales')+stat(t.km.toFixed(1),'km totales');
  const hid=+$('#selHist').value,hl=acts.filter(a=>a.estudianteId===hid).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  $('#tbHist').innerHTML=hl.map(a=>`<tr><td>${esc(a.fecha)}</td><td>${esc(a.actividad)}</td><td>${a.min}</td><td>${a.km}</td><td>${esc(a.obs)}</td><td>${a.lat?`<a href="https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=17/${a.lat}/${a.lng}" target="_blank" rel="noopener">${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}</a>`:'—'}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">Sin actividades registradas.</td></tr>';
  const did=+$('#selDes').value,dl=acts.filter(a=>a.estudianteId===did),d=calc(dl);
  $('#statsDes').innerHTML=stat(d.n,'actividades')+stat(d.min+' min','tiempo acumulado')+stat(d.km.toFixed(2)+' km','distancia recorrida');
  const mx=Math.max(1,...dl.map(a=>a.km));
  $('#bars').innerHTML=dl.slice(-8).map(a=>`<div class="bar"><span>${esc(a.fecha)}</span><i style="width:${a.km/mx*100}%"></i><span>${a.km} km</span></div>`).join('');
}
async function load(){ests=await all('estudiantes');acts=await all('actividades');cat=await all('catalogo');
  let seeded=false;try{seeded=localStorage.getItem('ss-seed')}catch{}
  if(!cat.length&&!seeded){for(const n of ['Carrera continua','Natación','Ciclismo','Circuito de fuerza'])await add('catalogo',{nombre:n,desc:''});
    try{localStorage.setItem('ss-seed','1')}catch{}cat=await all('catalogo');}
  render();}
// ---------- Navegación ----------
$('#tabs').onclick=e=>{const v=e.target.dataset.v;if(!v)return;
  document.querySelectorAll('.view,#tabs button').forEach(x=>x.classList.remove('on'));
  $('#'+v).classList.add('on');e.target.classList.add('on');};
['#selHist','#selDes'].forEach(s=>$(s).onchange=render);
// ---------- Formularios ----------
$('#fEst').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);
  await add('estudiantes',{nombre:f.get('nombre').trim(),grupo:f.get('grupo').trim(),disciplina:f.get('disciplina')});
  e.target.reset();await load();};
$('#btnGeo').onclick=()=>{const o=$('#geoOut');
  if(!navigator.geolocation){o.textContent='Tu navegador no soporta geolocalización.';return;}
  o.textContent='Obteniendo ubicación…';
  navigator.geolocation.getCurrentPosition(p=>{pos={lat:p.coords.latitude,lng:p.coords.longitude};
    o.innerHTML=`Ubicación lista: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} (±${Math.round(p.coords.accuracy)} m) <a href="https://www.openstreetmap.org/?mlat=${pos.lat}&mlon=${pos.lng}#map=17/${pos.lat}/${pos.lng}" target="_blank" rel="noopener">Ver mapa</a>`;},
  err=>{pos=null;o.textContent={1:'Permiso denegado: actívalo en el candado de la barra de direcciones.',2:'Ubicación no disponible (sin internet, una computadora no puede calcularla). Puedes guardar la actividad sin ella.',3:'Tiempo agotado, intenta de nuevo.'}[err.code]||'No se pudo obtener la ubicación.';},
  {enableHighAccuracy:false,timeout:15000,maximumAge:600000});};
$('#fAct').onsubmit=async e=>{e.preventDefault();try{await saveAct(e)}catch(err){console.error(err);$('#msg').textContent='Error al guardar: '+err.message}};
async function saveAct(e){const f=new FormData(e.target);
  if(!f.get('estudianteId'))return $('#msg').textContent='Primero registra un estudiante.';
  const a={estudianteId:+f.get('estudianteId'),fecha:f.get('fecha'),actividad:f.get('actividad').trim(),min:+f.get('min'),km:+f.get('km'),obs:f.get('obs').trim(),synced:false};
  if(pos){a.lat=pos.lat;a.lng=pos.lng;}
  await add('actividades',a);e.target.reset();pos=null;$('#geoOut').textContent='Ubicación no agregada (opcional)';await load();
  const est=ests.find(x=>x.id===a.estudianteId);
  $('#msg').textContent=navigator.onLine?'Actividad guardada.':'Actividad guardada sin conexión. Se sincronizará al reconectar.';
  if(navigator.onLine)syncPending();
  notify('Actividad registrada',`${est?.nombre}: ${a.actividad}, ${a.min} min, ${a.km} km`);}
$('#fCat').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);
  await add('catalogo',{nombre:f.get('nombre').trim(),desc:f.get('desc').trim()});e.target.reset();await load();};
$('#listCat').onclick=async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.del){await del('catalogo',+b.dataset.del);await load();}
  else if(b.dataset.use){$('#selCat').value=b.dataset.use;$('#fAct').scrollIntoView({behavior:'smooth'});}};
// ---------- Notificaciones ----------
async function notify(t,body){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  try{const reg=await Promise.race([navigator.serviceWorker.ready,new Promise((_,k)=>setTimeout(k,3000))]);
    await reg.showNotification(t,{body,icon:'icons/icon-192.png'});}
  catch{try{new Notification(t,{body})}catch{}}}
$('#btnPerm').onclick=async()=>{if(!('Notification' in window))return alert('Tu navegador no soporta notificaciones.');
  const p=await Notification.requestPermission();$('#btnPerm').textContent=p==='granted'?'Notificaciones activas':'Permiso: '+p;};
// ---------- Fetch API ----------
// Endpoint de prueba (jsonplaceholder). Es DEMOSTRATIVO: no hay sincronización real de datos.
$('#btnSync').onclick=async()=>{const o=$('#fetchOut');o.textContent='Consultando…';
  try{const r=await fetch('https://jsonplaceholder.typicode.com/posts',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({title:'SportSchool',registros:acts.length})});
    o.textContent=`HTTP ${r.status}\n${JSON.stringify(await r.json(),null,2)}\n(Solicitud demostrativa, sin sincronización real.)`;
  }catch{o.textContent='Sin conexión: se muestran los datos locales guardados en el dispositivo.';}};
// ---------- Sincronización de pendientes ----------
let syncing=false;
async function syncPending(){
  if(syncing||!navigator.onLine)return;syncing=true;
  try{for(const a of (await all('actividades')).filter(x=>!x.synced)){
    const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),8000);
    const r=await fetch('https://jsonplaceholder.typicode.com/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a),signal:ac.signal});clearTimeout(tm);
    if(!r.ok)throw new Error(r.status);
    await put('actividades',{...a,synced:true});}
  }catch(err){console.warn('Sincronización pendiente',err);}
  syncing=false;await load();
}
$('#btnPush').onclick=async()=>{const o=$('#fetchOut');
  if(!navigator.onLine){o.textContent='Sin conexión: los pendientes se enviarán al reconectar.';return;}
  await syncPending();o.textContent='Sincronización demostrativa completada (endpoint de prueba).';};
// ---------- Conectividad, SW, arranque ----------
const net=()=>{$('#banner').hidden=navigator.onLine;if(navigator.onLine)syncPending();const n=$('#net');n.textContent=navigator.onLine?'en línea':'sin conexión';n.classList.toggle('off',!navigator.onLine);};
addEventListener('online',net);addEventListener('offline',net);net();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').then(()=>console.log('SW registrado')).catch(console.error);
open().then(load).catch(console.error);
setTimeout(()=>$('#splash').classList.add('hide'),2000);