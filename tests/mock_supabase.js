// In-memory PostgREST subset for tests: projects / annotations / comments with the app's RLS rules.
const OP_KEY='op-secret-key-1234567890', ANON='anon.key.test';
function makeMock(){
  const db={projects:[],annotations:[],comments:[]};
  const log=[];
  let down=false;
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Access-Control-Expose-Headers':'*'};
  const json=(route,status,body)=>route.fulfill({status,headers:{...cors,'Content-Type':'application/json'},body:body==null?'':JSON.stringify(body)});
  const isOp=h=>h['x-operator-key']===OP_KEY;
  const tokenOk=(h,pid)=>{const p=db.projects.find(p=>p.id===pid);return !!(p&&h['x-review-token']&&p.review_token===h['x-review-token']);};
  function parseFilters(sp){const f=[];for(const [k,v] of sp){if(['select','order','limit','on_conflict'].includes(k))continue;const m=v.match(/^(eq|is)\.(.*)$/);if(m)f.push([k,m[1],m[2]]);}return f;}
  const applyFilters=(rows,f)=>rows.filter(r=>f.every(([k,op,v])=>op==='eq'?String(r[k])===v:op==='is'?(v==='null'?r[k]==null:v==='false'?r[k]===false:r[k]===true):true));
  async function handler(route){
    const req=route.request();const url=new URL(req.url());const h=req.headers();const method=req.method();
    log.push({method,path:url.pathname+url.search,headers:{apikey:h['apikey'],auth:h['authorization'],tok:h['x-review-token'],op:h['x-operator-key'],prefer:h['prefer']}});
    if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
    if(down)return route.abort('failed');
    if(h['apikey']!==ANON||h['authorization']!=='Bearer '+ANON)return json(route,401,{message:'Invalid API key'});
    const path=url.pathname.replace('/rest/v1/','');
    const sp=url.searchParams;const filters=parseFilters(sp);
    const body=()=>{try{return JSON.parse(req.postData()||'null');}catch{return null;}};
    if(path==='rpc/is_operator'&&method==='POST')return json(route,200,isOp(h));
    if(path==='projects'){
      if(method==='GET'){let rows=db.projects.filter(p=>isOp(h)||(h['x-review-token']&&p.review_token===h['x-review-token']));rows=applyFilters(rows,filters);const sel=(sp.get('select')||'*');if(sel!=='*'){const cols=sel.split(',');rows=rows.map(r=>Object.fromEntries(cols.map(c=>[c,r[c]])));}return json(route,200,rows);}
      if(method==='POST'){if(!isOp(h))return json(route,401,{code:'42501',message:'new row violates row-level security policy'});const b=body();const rows=Array.isArray(b)?b:[b];for(const r of rows){if(db.projects.some(p=>p.id===r.id))return json(route,409,{message:'duplicate'});db.projects.push({archived:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...r});}return json(route,201,null);}
      if(method==='PATCH'){if(!isOp(h))return json(route,401,{message:'rls'});const b=body();applyFilters(db.projects,filters).forEach(p=>Object.assign(p,b));return json(route,204,null);}
    }
    if(path==='annotations'){
      if(method==='GET'){let rows=db.annotations.filter(a=>isOp(h)||tokenOk(h,a.project_id));rows=applyFilters(rows,filters);const sel=sp.get('select')||'*';if(sel.includes('comments(*)'))rows=rows.map(a=>({...a,comments:db.comments.filter(c=>c.annotation_id===a.id)}));else if(sel!=='*'){const cols=sel.split(',');rows=rows.map(r=>Object.fromEntries(cols.map(c=>[c,r[c]])));}if((sp.get('order')||'').startsWith('t.'))rows.sort((a,b)=>a.t-b.t);return json(route,200,rows);}
      if(method==='POST'){const b=body();const rows=Array.isArray(b)?b:[b];const merge=(h['prefer']||'').includes('merge-duplicates');for(const r of rows){if(!(isOp(h)||tokenOk(h,r.project_id)))return json(route,401,{code:'42501',message:'row-level security'});if(String(r.thumb||'').length>1200000)return json(route,400,{message:'thumb too large'});const i=db.annotations.findIndex(a=>a.id===r.id);if(i>=0){if(!merge)return json(route,409,{message:'duplicate key'});db.annotations[i]={...db.annotations[i],...r};}else db.annotations.push({...r});}return json(route,201,null);}
    }
    if(path==='comments'&&method==='GET'){return json(route,200,db.comments.filter(c=>isOp(h)||tokenOk(h,c.project_id)));}
    return json(route,404,{message:'not found: '+method+' '+path});
  }
  return {db,log,handler,setDown:v=>{down=v;},OP_KEY,ANON};
}
module.exports={makeMock,OP_KEY,ANON};
