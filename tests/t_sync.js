// 선택 검사: npm i playwright 후 node tests/t_sync.js  (CHROME=크롬경로)
const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
const {makeMock,OP_KEY,ANON}=require('./mock_supabase');
const APP='file://'+require('path').resolve(__dirname,'..','index.html') /* SERVER_DEFAULT에 테스트 서버 값이 들어간 빌드를 가리키세요 */, SB='https://mock.supabase.co';
let failures=0; const ok=(c,m)=>{if(c)console.log('ok  -',m);else{console.log('FAIL:',m);failures++;}};
(async()=>{
  const mock=makeMock();
  const b=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--mute-audio']});
  const newPage=async()=>{const ctx=await b.newContext({viewport:{width:1400,height:860},acceptDownloads:true});await ctx.route(SB+'/**',mock.handler);const page=await ctx.newPage();page.on('dialog',d=>d.accept());page.__errs=[];page.on('pageerror',e=>page.__errs.push(e.message));return page;};
  const openFile=async(page,f)=>{await page.setInputFiles('#fileVideo',f);await page.waitForFunction(()=>document.querySelector('#video').videoWidth>0);await page.waitForTimeout(400);};
  const addMemo=async(page,fx,fy,text)=>{const ob=await page.locator('#overlay').boundingBox();await page.mouse.click(ob.x+ob.width*fx,ob.y+ob.height*fy);await page.waitForTimeout(250);await page.keyboard.press('Enter');await page.keyboard.type(text);await page.keyboard.press('Enter');await page.waitForTimeout(150);};
  const chip=p=>p.textContent('#syncChip');
  const waitChip=async(p,re,ms=6000)=>{await p.waitForFunction(r=>new RegExp(r).test(document.querySelector('#syncChip').textContent),re.source,{timeout:ms}).catch(()=>{});return chip(p);};

  // ===== 운영자 =====
  const op=await newPage();
  await op.goto(APP); await op.evaluate(()=>{localStorage.clear();indexedDB.deleteDatabase('hhss-review');});
  ok(await op.evaluate(()=>document.querySelector('#syncChip').hidden&&document.querySelector('#authorWrap').hidden),'operator mode: no chip/author by default');
  await openFile(op,path.join(__dirname,'media','test.mp4'));
  await op.evaluate(()=>{document.querySelector('#video').currentTime=1;}); await op.waitForTimeout(300);
  await addMemo(op,0.3,0.3,'첫 번째 메모');
  await op.evaluate(()=>{document.querySelector('#video').currentTime=3;}); await op.waitForTimeout(300);
  await addMemo(op,0.6,0.6,'두 번째 메모');
  // 서버 설정
  await op.click('#btnServer'); await op.click('#btnServerSettings');
  await op.fill('#svUrl',SB+'/'); await op.fill('#svAnon',ANON); await op.fill('#svOp','wrong-key-xxxxxxxx'); await op.fill('#svApp','https://example.github.io/review/');
  await op.click('#svTest'); await op.waitForTimeout(300);
  ok((await op.textContent('#svStatus')).includes('운영자 키가 맞지 않아요'),'test with wrong operator key reports key mismatch');
  await op.fill('#svOp',OP_KEY); await op.click('#svTest'); await op.waitForTimeout(300);
  ok((await op.textContent('#svStatus')).includes('연결 확인'),'test with right key: '+await op.textContent('#svStatus'));
  await op.click('#svSave'); await op.waitForTimeout(200);
  ok(!JSON.stringify(fs.readFileSync(APP.replace('file://',''),'utf8')).includes(OP_KEY),'operator key never in the HTML file');
  // 프로젝트 만들기
  await op.click('#btnServer'); await op.click('#btnNewProject'); await op.waitForTimeout(200);
  ok((await op.textContent('#pjSource')).includes('test.mp4'),'new project modal shows file source');
  await op.fill('#pjTitle','테스트 프로젝트'); await op.click('#pjCreate');
  await op.waitForSelector('#pjLink',{timeout:5000});
  const link=await op.inputValue('#pjLink');
  const proj=mock.db.projects[0];
  ok(proj&&proj.title==='테스트 프로젝트'&&proj.source_kind==='file'&&proj.file_name==='test.mp4'&&proj.review_token.length>=20,'project row created: '+JSON.stringify({t:proj&&proj.title,k:proj&&proj.source_kind,f:proj&&proj.file_name}));
  ok(link===`https://example.github.io/review/#r=${proj.id}.${proj.review_token}`,'client link uses appUrl + #r=id.token');
  await waitChip(op,/서버 저장됨/);
  ok((await chip(op)).startsWith('서버 저장됨'),'chip saved after initial upload: '+await chip(op));
  ok(mock.db.annotations.length===2&&mock.db.annotations.every(a=>a.project_id===proj.id&&a.thumb.startsWith('data:image/jpeg')&&a.rev>=1),'2 annotations upserted with thumbs');
  await op.click('#mProject [data-close]'); await op.waitForTimeout(200);
  // 편집 → rev 증가
  await op.click('.memo >> nth=0 >> .text'); await op.waitForTimeout(200); await op.keyboard.type(' (수정)'); await op.keyboard.press('Enter');
  await waitChip(op,/서버 저장됨/);
  const a0=mock.db.annotations.find(a=>a.text==='첫 번째 메모 (수정)');
  ok(a0&&a0.rev===2,'edit pushed with rev 2');
  // 삭제 → soft delete
  await op.click('.memo >> nth=1 >> .del'); await waitChip(op,/서버 저장됨/);
  const del=mock.db.annotations.find(a=>a.text==='두 번째 메모');
  ok(del&&del.deleted_at,'delete pushed as deleted_at');
  // 되돌리기 → deleted_at null
  await op.keyboard.press('Control+z'); await waitChip(op,/서버 저장됨/);
  ok(mock.db.annotations.find(a=>a.text==='두 번째 메모').deleted_at===null,'undo clears deleted_at');
  // 클라이언트 HTML 생성
  await op.click('#btnServer'); await op.click('#btnProjects'); await op.waitForSelector('.plist .p');
  ok((await op.textContent('.plist .p .pt')).includes('테스트 프로젝트')&&(await op.textContent('.plist .p .pt')).includes('메모 2개'),'project list shows title and count');
  const [dl]=await Promise.all([op.waitForEvent('download'),op.click('.plist .p button[data-act="html"]')]);
  const clientFile=path.join(__dirname,'client_test.html'); await dl.saveAs(clientFile);
  const chtml=fs.readFileSync(clientFile,'utf8');
  ok(chtml.includes('id="hhss-client-config"')&&chtml.includes(proj.review_token)&&!chtml.includes(OP_KEY)&&chtml.includes(ANON),'client HTML embeds token + anon key, not operator key');
  await op.click('#mProjects [data-close]'); await op.waitForTimeout(200);

  // ===== 클라이언트 (링크) =====
  const cl=await newPage();
  await cl.goto(APP+'#r='+proj.id+'.'+proj.review_token); await cl.waitForFunction(()=>document.querySelector('#count').textContent!=='0',null,{timeout:8000}).catch(()=>{});
  ok(await cl.evaluate(()=>document.body.classList.contains('client')&&!document.querySelector('#authorWrap').hidden),'client mode via #r= link');
  ok(await cl.evaluate(()=>getComputedStyle(document.querySelector('#serverMenu')).display==='none'&&getComputedStyle(document.querySelector('#btnSave')).display==='none'),'operator controls hidden for client');
  ok((await cl.textContent('#drop span')).includes('test.mp4'),'client drop screen names the expected file');
  ok((await cl.textContent('#count'))==='2','client pulled 2 memos before opening video');
  await cl.fill('#authorName','김고객'); await cl.press('#authorName','Tab');
  await openFile(cl,path.join(__dirname,'media','test.mp4'));
  await cl.evaluate(()=>{document.querySelector('#video').currentTime=5;}); await cl.waitForTimeout(300);
  await addMemo(cl,0.5,0.5,'고객 요청: 여기 자막 키워 주세요');
  await waitChip(cl,/서버 저장됨/);
  const crow=mock.db.annotations.find(a=>a.text.startsWith('고객 요청'));
  ok(crow&&crow.author==='김고객'&&crow.project_id===proj.id,'client memo pushed with author');
  const lastPost=mock.log.filter(l=>l.method==='POST'&&l.path.startsWith('/rest/v1/annotations')).pop();
  ok(lastPost&&lastPost.headers.tok===proj.review_token&&!lastPost.headers.op,'client requests carry x-review-token only');
  // 운영자가 pull → 작성자 배지
  await op.evaluate(()=>window.__hhss().Sync.pull()); await op.waitForTimeout(500);
  ok((await op.textContent('#count'))==='3'&&(await op.textContent('#list')).includes('김고객'),'operator sees client memo with author badge');
  // 오프라인 → 임시 저장 → 복구
  mock.setDown(true);
  await cl.evaluate(()=>{document.querySelector('#video').currentTime=2;}); await cl.waitForTimeout(300);
  await addMemo(cl,0.2,0.8,'오프라인 메모');
  await waitChip(cl,/오프라인/,5000);
  ok((await chip(cl)).includes('오프라인')&&(await chip(cl)).includes('1건'),'offline status shows pending count: '+await chip(cl));
  const pend=await cl.evaluate(()=>new Promise(r=>{const q=indexedDB.open('hhss-review',1);q.onsuccess=()=>{const t=q.result.transaction('kv','readonly').objectStore('kv');const g=t.getAllKeys();g.onsuccess=()=>r(g.result);};}));
  ok(pend.some(k=>k.startsWith('hhss:pending:')),'pending queue persisted in IndexedDB: '+pend.join(','));
  mock.setDown(false);
  await cl.click('#syncChip'); await waitChip(cl,/서버 저장됨/);
  ok(!!mock.db.annotations.find(a=>a.text==='오프라인 메모'),'pending memo sent after reconnect');
  // 새로고침 후 pending 유지 확인 (서버 다운 상태에서 메모 → 새로고침 → 서버 복구 → 전송)
  mock.setDown(true);
  await cl.evaluate(()=>{document.querySelector('#video').currentTime=4;}); await cl.waitForTimeout(300);
  await addMemo(cl,0.4,0.4,'새로고침 전 메모'); await waitChip(cl,/오프라인/,5000);
  await cl.reload(); await cl.waitForFunction(()=>document.querySelector('#count').textContent!=='0',null,{timeout:8000}).catch(()=>{}); await cl.waitForTimeout(300);
  ok((await cl.textContent('#count'))==='5','after reload (server down) memos restored from autosave: '+await cl.textContent('#count'));
  mock.setDown(false);
  await cl.evaluate(()=>window.__hhss().Sync.flush()); await waitChip(cl,/서버 저장됨/);
  ok(!!mock.db.annotations.find(a=>a.text==='새로고침 전 메모'),'pending survived reload and was sent');
  // 잘못된 토큰
  const bad=await newPage(); await bad.goto(APP+'#r='+proj.id+'.WRONGTOKENWRONGTOKENWRONG'); await bad.waitForTimeout(600);
  ok((await bad.textContent('#dropErr')).includes('열 수 있는 검수 프로젝트가 없어요'),'wrong token → clear message');
  // ===== 클라이언트 (동봉 HTML, file://) =====
  const cf=await newPage(); await cf.goto('file://'+clientFile); await cf.waitForFunction(()=>document.querySelector('#count').textContent!=='0',null,{timeout:8000}).catch(()=>{});
  ok(await cf.evaluate(()=>document.body.classList.contains('client'))&&(await cf.textContent('#count'))==='5','embedded client HTML opens in client mode and pulls memos: '+await cf.textContent('#count')+' chip='+await chip(cf)+' err='+(await cf.textContent('#dropErr')).slice(0,80)+' remote='+await cf.evaluate(()=>JSON.stringify(window.__hhss().S.remote&&window.__hhss().S.remote.projectId))+' dbcount='+mock.db.annotations.filter(a=>!a.deleted_at).length);
  ok((await cf.title()).includes('테스트 프로젝트'),'client HTML title: '+await cf.title());
  // ===== 운영자: 서버 프로젝트 다시 열기 (새 브라우저) =====
  const op2=await newPage(); await op2.goto(APP);
  await op2.evaluate((cfg)=>localStorage.setItem('hhss:server',JSON.stringify(cfg)),{url:SB,anonKey:ANON,operatorKey:OP_KEY,appUrl:'https://example.github.io/review/'});
  await op2.reload(); await op2.click('#btnServer'); await op2.click('#btnProjects'); await op2.waitForSelector('.plist .p button[data-act="open"]');
  await op2.click('.plist .p button[data-act="open"]'); await op2.waitForFunction(()=>document.querySelector('#count').textContent!=='0',null,{timeout:8000}).catch(()=>{});
  ok((await op2.textContent('#count'))==='5'&&(await op2.textContent('#dropErr')).includes('test.mp4'),'operator reopens file project: memos loaded + asks for the file: count='+await op2.textContent('#count')+' err='+(await op2.textContent('#dropErr')).slice(0,60)+' chip='+await chip(op2));
  await openFile(op2,path.join(__dirname,'media','test.mp4'));
  ok(await op2.evaluate(()=>document.querySelector('#drop').classList.contains('hidden')),'file opened in reopened project');
  await op2.screenshot({path:path.join(__dirname,'d_op.png')}); await cl.screenshot({path:path.join(__dirname,'d_client.png')});
  for(const [n,p] of [['op',op],['cl',cl],['op2',op2],['cf',cf]])ok(!p.__errs.length,n+' page errors: '+p.__errs.join(' | '));
  console.log(failures?`\n${failures} FAILED`:'\nALL PASSED');
  await b.close(); process.exit(failures?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(1);});
