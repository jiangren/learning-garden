(() => {
  const URL = 'https://yapfznblgttmpgjlkkis.supabase.co';
  const KEY = 'sb_publishable_hn9MPMnhdo287QPXWdbdmg_6uvxyZ3C';
  const SESSION = 'chengbao.sync.session';
  const APP = location.pathname.includes('/bunny-pinyin-garden/') ? 'bunny' : location.pathname.includes('/sweet-math/') ? 'sweet' : null;
  const STORAGE = { bunny: 'bunny-pinyin', sweet: 'sweetmath.progress.v1' };
  const BASE = app => `chengbao.sync.base.${session.user.id}.${app}`;
  let session = null, busy = false, conflict = null;
  try { session = JSON.parse(localStorage.getItem(SESSION)); } catch (_) {}
  const style = document.createElement('style');
  style.textContent = '.cs-btn{position:fixed;right:16px;bottom:16px;z-index:9990;border:0;border-radius:30px;padding:12px 18px;background:#5a6847;color:white;font:600 14px system-ui;box-shadow:0 4px 18px #0003;cursor:pointer}.cs-shade{position:fixed;inset:0;background:#0008;z-index:9999;display:grid;place-items:center;padding:18px}.cs-box{background:#fffaf4;color:#403c35;border-radius:20px;padding:24px;width:min(420px,100%);box-sizing:border-box;font:15px/1.6 system-ui;box-shadow:0 12px 40px #0004}.cs-box h2{font-size:22px;margin:0 0 12px}.cs-box input{display:block;box-sizing:border-box;width:100%;padding:12px;margin:8px 0 14px;border:1px solid #aaa;border-radius:8px;font:inherit}.cs-box button{padding:10px 14px;margin:5px 6px 0 0;border:0;border-radius:9px;background:#536c4c;color:#fff;font:inherit;cursor:pointer}.cs-box .secondary{background:#ece8df;color:#403c35}.cs-box p{margin:8px 0}';
  document.head.append(style);
  const btn = document.createElement('button'); btn.className = 'cs-btn'; btn.textContent = '家长 · 进度同步'; document.body.append(btn);
  const box = document.createElement('div'); box.className = 'cs-shade'; box.hidden = true; box.style.display = 'none'; document.body.append(box);
  const show = html => { box.innerHTML = `<div class="cs-box" role="dialog" aria-modal="true">${html}</div>`; box.style.display='grid'; };
  const close = () => { box.style.display='none'; box.innerHTML=''; };
  const msg = (text) => { const e=box.querySelector('[data-msg]'); if(e)e.textContent=text; };
  const headers = (token) => ({ apikey: KEY, Authorization: `Bearer ${token || KEY}`, 'Content-Type': 'application/json' });
  async function api(path, options={}) {
    const res = await fetch(URL + path, options);
    let body = null; try { body = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(body?.msg || body?.message || `HTTP ${res.status}`);
    return body;
  }
  async function refresh() {
    if (!session) throw Error('请先登录');
    if (session.expires_at > Date.now()/1000 + 60) return;
    const data = await api('/auth/v1/token?grant_type=refresh_token', {method:'POST',headers:headers(),body:JSON.stringify({refresh_token:session.refresh_token})});
    session = {...data, expires_at: Math.floor(Date.now()/1000) + data.expires_in}; localStorage.setItem(SESSION,JSON.stringify(session));
  }
  async function login(email,password) {
    const data = await api('/auth/v1/token?grant_type=password',{method:'POST',headers:headers(),body:JSON.stringify({email,password})});
    session={...data,expires_at:Math.floor(Date.now()/1000)+data.expires_in}; localStorage.setItem(SESSION,JSON.stringify(session));
  }
  function local(app){const raw=localStorage.getItem(STORAGE[app]); if(!raw)return null; try{return JSON.parse(raw)}catch(_){throw Error('本地进度格式异常')}}
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
  const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  async function get(app) { const q=`?user_id=eq.${encodeURIComponent(session.user.id)}&app=eq.${app}&select=data,version`; const rows=await api('/rest/v1/learning_progress'+q,{headers:headers(session.access_token)});return rows[0]||null; }
  async function put(app,data,remote) {
    const version=crypto.randomUUID();
    const row={user_id:session.user.id,app,data,version,updated_at:new Date().toISOString()};
    let path='/rest/v1/learning_progress', method='POST';
    if(remote){path+=`?user_id=eq.${session.user.id}&app=eq.${app}&version=eq.${remote.version}`; method='PATCH';}
    const res=await fetch(URL+path,{method,headers:{...headers(session.access_token),Prefer:'return=representation'},body:JSON.stringify(row)});
    if(!res.ok)throw Error(res.status===409?'云端记录刚刚发生变化，请重试':`同步失败 (${res.status})`);
    const rows=await res.json(); if(!rows.length)throw Error('云端记录刚刚发生变化，请重试');
    localStorage.setItem(BASE(app),JSON.stringify({data,version}));
  }
  async function synchronize(app) {
    await refresh();
    const remote=await get(app), here=local(app); let base=null;
    try{base=JSON.parse(localStorage.getItem(BASE(app)))}catch(_){}
    if(!remote){if(here)await put(app,here,null);return;}
    if(equal(here,remote.data)){localStorage.setItem(BASE(app),JSON.stringify({data:here,version:remote.version}));return;}
    if(!here || (base && equal(here,base.data))) {
      localStorage.setItem(STORAGE[app],JSON.stringify(remote.data));localStorage.setItem(BASE(app),JSON.stringify({data:remote.data,version:remote.version}));
      if(APP===app) location.reload(); return;
    }
    if(base && remote.version===base.version){await put(app,here,remote);return;}
    conflict={app,remote}; throw Error(`${app==='bunny'?'拼音':'数学'}进度在本机和云端不一致，请选择保留哪一份`);
  }
  async function run() {
    if(!session || busy)return; busy=true;
    try { for(const app of APP?[APP]:['bunny','sweet'])await synchronize(app); btn.textContent='家长 · 已同步'; }
    catch(e){btn.textContent='家长 · 同步需处理'; if(box.style.display!=='none')msg(e.message);}
    finally {busy=false;}
  }
  function panel(){
    if(!session){show('<h2>家长登录</h2><p>使用创建的学习乐园账号，在不同浏览器同步进度。</p><label>邮箱<input type="email" data-email autocomplete="username"></label><label>密码<input type="password" data-password autocomplete="current-password"></label><p data-msg role="status"></p><button data-login>登录并同步</button><button class="secondary" data-close>关闭</button>'); box.querySelector('[data-login]').onclick=async()=>{try{msg('正在登录…');await login(box.querySelector('[data-email]').value,box.querySelector('[data-password]').value);box.querySelector('[data-password]').value='';await run();panel()}catch(e){msg('登录失败：'+e.message)}}; }
    else {show(`<h2>学习进度同步</h2><p>已登录。学习记录会保存在本机并定期同步。</p><p data-msg role="status">${conflict?'本机与云端进度不同，请选择保留哪一份。':''}</p><button data-sync>立即同步</button>${conflict?'<button data-cloud>使用云端进度</button><button data-local>保留本机进度</button>':''}<button class="secondary" data-logout>退出登录</button><button class="secondary" data-close>关闭</button>`);
      box.querySelector('[data-sync]').onclick=async()=>{conflict=null;msg('正在同步…');await run();if(conflict)panel();else msg(btn.textContent==='家长 · 已同步'?'同步完成':'同步失败，请检查网络或重新登录');};
      box.querySelector('[data-logout]').onclick=()=>{session=null;localStorage.removeItem(SESSION);conflict=null;btn.textContent='家长 · 进度同步';panel()};
      if(conflict){box.querySelector('[data-cloud]').onclick=async()=>{const c=conflict;localStorage.setItem(STORAGE[c.app],JSON.stringify(c.remote.data));localStorage.setItem(BASE(c.app),JSON.stringify({data:c.remote.data,version:c.remote.version}));conflict=null;if(APP===c.app)location.reload();else panel()};box.querySelector('[data-local]').onclick=async()=>{try{await refresh();await put(conflict.app,local(conflict.app),conflict.remote);conflict=null;await run();panel()}catch(e){msg(e.message)}};}
    }
    box.querySelector('[data-close]').onclick=close;
  }
  btn.onclick=panel; if(session)run(); setInterval(run,30000); window.addEventListener('online',run);
})();
