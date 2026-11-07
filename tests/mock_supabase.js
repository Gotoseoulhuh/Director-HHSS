// 테스트용 Supabase 흉내: Auth(비밀번호·refresh 토큰) + PostgREST 일부(projects / annotations / comments / rpc) + 앱과 같은 RLS 규칙.
const ANON='anon.key.test';
const ADMIN={email:'admin@hhss.studio',password:'admin-pass-1234',id:'u-admin'};
const OTHER={email:'other@hhss.studio',password:'other-pass-1234',id:'u-other'}; /* 로그인은 되지만 관리자 아님 */
function makeMock(){
  const db={projects:[],annotations:[],comments:[]};
  const users=[ADMIN,OTHER],operators=new Set([ADMIN.id]);
  const access=new Map(),refresh=new Map();
  const log=[];
  let down=false,tokenTtl=3600;
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Access-Control-Expose-Headers':'*'};
  const json=(route,status,body)=>route.fulfill({status,headers:{...cors,'Content-Type':'application/json'},body:body===undefined?'':JSON.stringify(body)});
  const rnd=()=>Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
  const issue=u=>{const a='at-'+rnd(),r='rt-'+rnd();access.set(a,{id:u.id,exp:Date.now()/1000+tokenTtl});refresh.set(r,u.id);return{access_token:a,refresh_token:r,expires_in:tokenTtl,expires_at:Math.floor(Date.now()/1000+tokenTtl),user:{id:u.id,email:u.email}};};
  const userOf=h=>{const b=(h['authorization']||'').replace(/^Bearer /,'');const t=access.get(b);return t&&t.exp>Date.now()/1000?t.id:null;};
  const isOp=h=>operators.has(userOf(h));
  const tokenOk=(h,pid)=>{const p=db.projects.find(p=>p.id===pid);return !!(p&&!p.archived&&h['x-review-token']&&p.review_token===h['x-review-token']);};
  function parseFilters(sp){const f=[];for(const [k,v] of sp){if(['select','order','limit','on_conflict'].includes(k))continue;const m=v.match(/^(eq|is)\.(.*)$/);if(m)f.push([k,m[1],m[2]]);}return f;}
  const applyFilters=(rows,f)=>rows.filter(r=>f.every(([k,op,v])=>op==='eq'?String(r[k])===v:op==='is'?(v==='null'?r[k]==null:v==='false'?r[k]===false:r[k]===true):true));
  async function handler(route){
    const req=route.request();const url=new URL(req.url());const h=req.headers();const method=req.method();
    log.push({method,path:url.pathname+url.search,headers:{apikey:h['apikey'],auth:h['authorization'],tok:h['x-review-token'],prefer:h['prefer']}});
    if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
    if(down)return route.abort('failed');
    if(h['apikey']!==ANON)return json(route,401,{message:'Invalid API key'});
    const body=()=>{try{return JSON.parse(req.postData()||'null');}catch{return null;}};
    // ----- Auth -----
    if(url.pathname==='/auth/v1/token'&&method==='POST'){
      const g=url.searchParams.get('grant_type'),b=body()||{};
      if(g==='password'){const u=users.find(u=>u.email===b.email&&u.password===b.password);if(!u)return json(route,400,{error:'invalid_grant',error_description:'Invalid login credentials'});return json(route,200,issue(u));}
      if(g==='refresh_token'){const id=refresh.get(b.refresh_token);if(!id)return json(route,400,{error:'invalid_grant',error_description:'Invalid Refresh Token'});refresh.delete(b.refresh_token);return json(route,200,issue(users.find(u=>u.id===id)));}
      return json(route,400,{error:'unsupported'});
    }
    if(url.pathname==='/auth/v1/logout')return json(route,204);
    // ----- REST -----
    const auth=h['authorization']||'';
    if(auth!=='Bearer '+ANON&&!userOf(h))return json(route,401,{message:'JWT expired or invalid'});
    const path=url.pathname.replace('/rest/v1/','');
    const sp=url.searchParams;const filters=parseFilters(sp);
    if(path==='rpc/is_operator'&&method==='POST')return json(route,200,isOp(h));
    if(path==='rpc/client_login'&&method==='POST'){const b=body()||{};const p=db.projects.find(p=>p.id===b.pid);
      const ok=p&&!p.archived&&p.client_login&&String(b.login||'').trim().toLowerCase()===p.client_login.toLowerCase()&&p.client_pw_hash==='hash:'+b.password;
      return json(route,200,ok?p.review_token:null);}
    if(path==='rpc/client_project'&&method==='POST'){const b=body()||{};const p=db.projects.find(p=>p.id===b.pid);
      if(!p||!tokenOk(h,p.id))return json(route,200,null);
      return json(route,200,{id:p.id,title:p.title,source_kind:p.source_kind,youtube_id:p.youtube_id,file_name:p.file_name,file_size:p.file_size,aspect:p.aspect,fps:p.fps});}
    if(path==='rpc/set_client_credentials'&&method==='POST'){if(!isOp(h))return json(route,403,{code:'42501',message:'관리자만'});const b=body()||{};const p=db.projects.find(p=>p.id===b.pid);
      if(String(b.login||'').trim().length<2||String(b.password||'').length<4)return json(route,400,{code:'22023'});
      if(p){p.client_login=String(b.login).trim();p.client_pw_hash='hash:'+b.password;p.review_token='tok'+rnd()+rnd();}return json(route,204);}
    if(path==='projects'){
      if(!isOp(h))return json(route,method==='GET'?200:401,method==='GET'?[]:{code:'42501',message:'permission denied'});
      if(method==='GET'){let rows=applyFilters(db.projects,filters);const sel=(sp.get('select')||'*');if(sel!=='*'){const cols=sel.split(',');rows=rows.map(r=>Object.fromEntries(cols.map(c=>[c,r[c]])));}return json(route,200,rows);}
      if(method==='POST'){const b=body();const rows=Array.isArray(b)?b:[b];for(const r of rows){if(db.projects.some(p=>p.id===r.id))return json(route,409,{message:'duplicate'});db.projects.push({archived:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),client_login:null,client_pw_hash:null,...r});}return json(route,201);}
      if(method==='PATCH'){const b=body();applyFilters(db.projects,filters).forEach(p=>Object.assign(p,b));return json(route,204);}
    }
    if(path==='annotations'){
      if(method==='GET'){let rows=db.annotations.filter(a=>isOp(h)||tokenOk(h,a.project_id));rows=applyFilters(rows,filters);const sel=sp.get('select')||'*';if(sel.includes('comments(*)'))rows=rows.map(a=>({...a,comments:db.comments.filter(c=>c.annotation_id===a.id)}));else if(sel!=='*'){const cols=sel.split(',');rows=rows.map(r=>Object.fromEntries(cols.map(c=>[c,r[c]])));}if((sp.get('order')||'').startsWith('t.'))rows.sort((a,b)=>a.t-b.t);return json(route,200,rows);}
      if(method==='POST'){const b=body();const rows=Array.isArray(b)?b:[b];const merge=(h['prefer']||'').includes('merge-duplicates');for(const r of rows){if(!(isOp(h)||tokenOk(h,r.project_id)))return json(route,401,{code:'42501',message:'row-level security'});if(String(r.thumb||'').length>1200000)return json(route,400,{message:'thumb too large'});const i=db.annotations.findIndex(a=>a.id===r.id);if(i>=0){if(!merge)return json(route,409,{message:'duplicate key'});db.annotations[i]={...db.annotations[i],...r};}else db.annotations.push({...r});}return json(route,201);}
    }
    if(path==='comments'&&method==='GET'){return json(route,200,db.comments.filter(c=>isOp(h)||tokenOk(h,c.project_id)));}
    return json(route,404,{message:'not found: '+method+' '+path});
  }
  return {db,log,handler,setDown:v=>{down=v;},setTokenTtl:v=>{tokenTtl=v;},ANON,ADMIN,OTHER};
}
module.exports={makeMock,ANON,ADMIN,OTHER};
