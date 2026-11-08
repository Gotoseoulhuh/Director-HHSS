// 선택 검사: npm i playwright 후 node tests/t_sync.js  (CHROME=크롬경로)
// index.html의 SERVER_DEFAULT가 {url:'https://mock.supabase.co',anonKey:'anon.key.test'}인 빌드를 가리켜야 함 (tests/README.md)
const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
const {makeMock,ANON,ADMIN,OTHER}=require('./mock_supabase');
const APP_FILE=process.env.APP||path.resolve(__dirname,'..','index.html'), APP='file://'+APP_FILE, SB='https://mock.supabase.co';
const MEDIA=process.env.MEDIA||path.join(__dirname,'media');
let failures=0; const ok=(c,m)=>{if(c)console.log('ok  -',m);else{console.log('FAIL:',m);failures++;}};
(async()=>{
  const mock=makeMock();
  const b=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--mute-audio']});
  const newPage=async(ctx)=>{ctx=ctx||await b.newContext({viewport:{width:1400,height:860},acceptDownloads:true});await ctx.route(SB+'/**',mock.handler);const page=await ctx.newPage();page.on('dialog',d=>d.accept(d.type()==='prompt'?'':undefined));page.__errs=[];page.on('pageerror',e=>page.__errs.push(e.message));return page;};
  const openFile=async(page,f)=>{await page.setInputFiles('#fileVideo',f);await page.waitForFunction(()=>document.querySelector('#video').videoWidth>0);await page.waitForTimeout(400);};
  const addMemo=async(page,fx,fy,text)=>{const ob=await page.locator('#overlay').boundingBox();await page.mouse.click(ob.x+ob.width*fx,ob.y+ob.height*fy);await page.waitForTimeout(250);await page.keyboard.type(text);await page.keyboard.press('Enter');await page.waitForTimeout(150);};
  const chip=p=>p.textContent('#syncChip');
  const waitChip=async(p,re,ms=6000)=>{await p.waitForFunction(r=>new RegExp(r).test(document.querySelector('#syncChip').textContent),re.source,{timeout:ms}).catch(()=>{});return chip(p);};
  const gateVisible=p=>p.evaluate(()=>!document.querySelector('#gate').hidden);
  const login=async(p,id,pw)=>{await p.fill('#gateId',id);await p.fill('#gatePw',pw);await p.click('#gateGo');await p.waitForTimeout(700);};

  // ===== 관리자 로그인 =====
  const op=await newPage();
  await op.goto(APP); await op.evaluate(()=>{localStorage.clear();sessionStorage.clear();indexedDB.deleteDatabase('hhss-review');}); await op.reload();
  ok(await gateVisible(op)&&(await op.textContent('#gateTitle'))==='관리자 로그인','admin: login screen first');
  await login(op,'admin','wrong-password');
  ok((await op.textContent('#gateMsg')).includes('맞지 않아요')&&await gateVisible(op),'wrong password rejected');
  await login(op,'other',OTHER.password);
  ok((await op.textContent('#gateMsg')).includes('관리자로 등록된 계정이 아니에요')&&await gateVisible(op),'non-operator account rejected');
  await login(op,'admin',ADMIN.password); /* 아이디만 넣으면 @hhss.studio */
  ok(!await gateVisible(op),'admin logged in with short id');
  ok(!(await op.content()).includes(ADMIN.password),'password not left in page');
  await op.reload(); await op.waitForTimeout(400);
  ok(!await gateVisible(op),'admin stays logged in after reload (keep login)');
  ok(await op.evaluate(()=>getComputedStyle(document.querySelector('#btnSend')).display==='none'),'admin has no quick-request button');
  ok((await op.textContent('#btnHelp')).trim()==='도움말','help button is labelled 도움말');

  // ===== 프로젝트 만들기 =====
  await openFile(op,path.join(MEDIA,'test.mp4'));
  await op.evaluate(()=>{document.querySelector('#video').currentTime=1;}); await op.waitForTimeout(300);
  await addMemo(op,0.3,0.3,'첫 번째 메모');
  await op.evaluate(()=>{document.querySelector('#video').currentTime=3;}); await op.waitForTimeout(300);
  await addMemo(op,0.6,0.6,'두 번째 메모');
  await op.click('#btnServer'); await op.click('#btnServerSettings');
  await op.fill('#svApp','https://review.example.com/'); await op.click('#svSave'); await op.waitForTimeout(200);
  await op.click('#btnServer'); await op.click('#btnNewProject'); await op.waitForTimeout(200);
  ok((await op.inputValue('#pjPw')).length===8,'password auto-generated');
  await op.fill('#pjTitle','테스트 프로젝트'); await op.fill('#pjLogin','x'); await op.click('#pjCreate'); await op.waitForTimeout(200);
  ok((await op.textContent('#pjStatus')).includes('아이디는'),'short client id rejected');
  await op.fill('#pjLogin','acme'); await op.fill('#pjPw','client-pw-1');
  await op.click('#pjCreate'); await op.waitForSelector('#pjGuide',{timeout:5000});
  const proj=mock.db.projects[0];
  ok(proj&&proj.client_login==='acme'&&proj.client_pw_hash==='hash:client-pw-1'&&proj.review_token.length>=20,'project with client credentials (hashed via rpc)');
  const link=await op.inputValue('#pjLink'),guide=await op.inputValue('#pjGuide');
  ok(link===`https://review.example.com/#p=${proj.id}`,'client link has project id only: '+link);
  ok(guide.includes(link)&&guide.includes('아이디: acme')&&guide.includes('비밀번호: client-pw-1')&&guide.includes('빠른 수정 요청'),'guide text has link, id, password, instructions');
  ok(!link.includes(proj.review_token),'link has no token');
  await waitChip(op,/서버 저장됨/);
  ok(mock.db.annotations.length===2&&mock.db.annotations.every(a=>a.project_id===proj.id),'operator memos uploaded');
  const [dl]=await Promise.all([op.waitForEvent('download'),op.click('#pjHtml')]);
  const clientFile=path.join(path.dirname(APP_FILE),'client_test.html'); await dl.saveAs(clientFile);
  const chtml=fs.readFileSync(clientFile,'utf8');
  ok(chtml.includes('id="hhss-client-config"')&&!chtml.includes(proj.review_token)&&!chtml.includes('client-pw-1')&&chtml.includes(ANON),'client HTML: project id + anon key, no token/password');
  await op.click('#mProject [data-close]'); await op.waitForTimeout(200);

  // ===== 클라이언트 =====
  const cl=await newPage();
  await cl.goto(link.replace('https://review.example.com/',APP)); await cl.waitForTimeout(500);
  ok(await gateVisible(cl)&&(await cl.textContent('#gateTitle'))==='영상 검수 로그인','client: login screen first');
  ok(await cl.evaluate(()=>document.querySelector('#gateKeepRow').hidden),'client gate hides keep-login option');
  await login(cl,'acme','nope');
  ok((await cl.textContent('#gateMsg')).includes('맞지 않아요'),'client wrong password rejected');
  await login(cl,'ACME','client-pw-1'); await cl.waitForTimeout(500);
  ok(!await gateVisible(cl)&&await cl.evaluate(()=>document.body.classList.contains('client')),'client logged in (id case-insensitive)');
  ok(await cl.evaluate(()=>document.querySelector('#mHelpClient').classList.contains('open')),'client help opens once automatically');
  await cl.click('#mHelpClient [data-close]');
  const vis=await cl.evaluate(()=>Object.fromEntries(['#sourceMenu','#btnOpen','#btnSave','#serverMenu','#btnSettings','#btnSend','#exportMenu','#btnHelp'].map(s=>[s,getComputedStyle(document.querySelector(s)).display!=='none'])));
  ok(!vis['#sourceMenu']&&!vis['#btnOpen']&&!vis['#btnSave']&&!vis['#serverMenu']&&!vis['#btnSettings'],'client: admin menus hidden '+JSON.stringify(vis));
  ok(vis['#btnSend']&&vis['#exportMenu']&&vis['#btnHelp'],'client: quick request, export, help visible');
  const colors=await cl.evaluate(()=>[getComputedStyle(document.querySelector('#btnSend')).backgroundColor,getComputedStyle(document.querySelector('#btnExport')).backgroundColor]);
  ok(colors[0]!=='rgb(255, 255, 255)'&&colors[1]==='rgb(255, 255, 255)','quick request colored, export plain: '+colors.join(' / '));
  ok((await cl.textContent('#drop span')).includes('test.mp4'),'client drop screen names the expected file');
  ok((await cl.textContent('#count'))==='2','client sees operator memos');
  await openFile(cl,path.join(MEDIA,'test.mp4'));
  await cl.evaluate(()=>{document.querySelector('#video').currentTime=5;}); await cl.waitForTimeout(300);
  await addMemo(cl,0.5,0.5,'고객 요청: 여기 자막 키워 주세요');
  await cl.waitForTimeout(1500);
  ok(!mock.db.annotations.find(a=>a.text.startsWith('고객 요청')),'client memo NOT sent before pressing the button');
  ok((await chip(cl)).includes('보내지 않은 수정 1건')&&(await cl.textContent('#btnSend .cnt'))==='1','unsent count shown: '+await chip(cl));
  await cl.click('#btnSend'); await cl.waitForTimeout(300);
  ok(!mock.db.annotations.find(a=>a.text.startsWith('고객 요청'))&&await cl.evaluate(()=>document.activeElement.id==='authorName'),'asks for reviewer name before sending');
  await cl.fill('#authorName','김고객'); await cl.press('#authorName','Tab');
  await cl.click('#btnSend'); await waitChip(cl,/모두 보냄/);
  const crow=mock.db.annotations.find(a=>a.text.startsWith('고객 요청'));
  ok(crow&&crow.author==='김고객'&&crow.project_id===proj.id,'sent with author after pressing');
  const lastPost=mock.log.filter(l=>l.method==='POST'&&l.path.startsWith('/rest/v1/annotations')).pop();
  ok(lastPost&&lastPost.headers.tok===proj.review_token&&lastPost.headers.auth==='Bearer '+ANON,'client requests use project token + anon key');
  await op.evaluate(()=>window.__hhss().Sync.pull()); await op.waitForTimeout(500);
  ok((await op.textContent('#count'))==='3'&&(await op.textContent('#list')).includes('김고객'),'operator sees client request with author badge');
  // 오프라인 → 보내기 실패 → 복구 후 다시 누르기
  mock.setDown(true);
  await cl.evaluate(()=>{document.querySelector('#video').currentTime=2;}); await cl.waitForTimeout(300);
  await addMemo(cl,0.2,0.8,'오프라인 메모');
  await cl.click('#btnSend'); await waitChip(cl,/인터넷 끊김|보내기 실패/,5000);
  ok(/인터넷 끊김|보내기 실패/.test(await chip(cl)),'send failure shown: '+await chip(cl));
  mock.setDown(false); await cl.waitForTimeout(2500);
  ok(!mock.db.annotations.find(a=>a.text==='오프라인 메모'),'client does not auto-retry');
  await cl.click('#btnSend'); await waitChip(cl,/모두 보냄/);
  ok(!!mock.db.annotations.find(a=>a.text==='오프라인 메모'),'sent after pressing again');
  // 새로고침: 로그인 유지 + 안 보낸 메모 유지
  await cl.evaluate(()=>{document.querySelector('#video').currentTime=4;}); await cl.waitForTimeout(300);
  await addMemo(cl,0.4,0.4,'새로고침 전 메모');
  await cl.reload(); await cl.waitForFunction(()=>document.querySelector('#count').textContent!=='0',null,{timeout:8000}).catch(()=>{}); await cl.waitForTimeout(500);
  ok(!await gateVisible(cl)&&(await cl.textContent('#count'))==='5','after reload: still logged in, 5 memos: '+await cl.textContent('#count'));
  ok((await chip(cl)).includes('1건'),'unsent memo survives reload: '+await chip(cl));
  await cl.click('#btnSend'); await waitChip(cl,/모두 보냄/);
  ok(!!mock.db.annotations.find(a=>a.text==='새로고침 전 메모'),'pending survived reload and was sent');
  await openFile(cl,path.join(MEDIA,'test.mp4')); /* 파일 프로젝트는 새로고침하면 영상 파일을 다시 넣어야 함 */
  // 관리자가 비밀번호 재설정 → 클라이언트 보내기 실패 → 다시 로그인 → 보냄
  await op.click('#btnServer'); await op.click('#btnProjects'); await op.waitForSelector('.plist .p button[data-act="reset"]');
  ok((await op.textContent('.plist .p .pt')).includes('아이디 acme'),'project list shows client id');
  await op.click('.plist .p button[data-act="reset"]'); await op.waitForTimeout(600);
  const newPw=mock.db.projects[0].client_pw_hash.replace('hash:','');
  ok(newPw.length===8&&newPw!=='client-pw-1','password reset (auto-generated) rotates credentials');
  await op.click('#mProjects [data-close]');
  await cl.evaluate(()=>{document.querySelector('#video').currentTime=1;}); await cl.waitForTimeout(300);
  await addMemo(cl,0.7,0.2,'재설정 후 메모');
  await cl.click('#btnSend'); await cl.waitForTimeout(800);
  ok(await gateVisible(cl)&&(await cl.textContent('#gateMsg')).includes('다시 로그인'),'stale token → asked to log in again');
  await login(cl,'acme',newPw); await cl.waitForTimeout(400);
  ok(!await gateVisible(cl)&&(await cl.textContent('#count'))==='6','re-login keeps the screen and memos');
  await cl.click('#btnSend'); await waitChip(cl,/모두 보냄/);
  ok(!!mock.db.annotations.find(a=>a.text==='재설정 후 메모'),'sent after re-login');
  // 보관하면 로그인 불가
  const cl2=await newPage(); await cl2.goto(link.replace('https://review.example.com/',APP)); await cl2.waitForTimeout(300);
  mock.db.projects[0].archived=true; await login(cl2,'acme',newPw);
  ok(await gateVisible(cl2)&&(await cl2.textContent('#gateMsg')).includes('마감'),'archived project: login refused');
  mock.db.projects[0].archived=false;
  // 동봉 HTML (file://): 로그인 화면 → 로그인
  const cf=await newPage(); await cf.goto('file://'+clientFile); await cf.waitForTimeout(400);
  ok(await gateVisible(cf),'embedded client HTML shows login first');
  await login(cf,'acme',newPw); await cf.waitForFunction(()=>document.querySelector('#count').textContent!=='0',null,{timeout:8000}).catch(()=>{});
  ok(!await gateVisible(cf)&&(await cf.textContent('#count'))==='6','embedded client HTML works after login: '+await cf.textContent('#count'));
  ok((await cf.title()).includes('테스트 프로젝트'),'client HTML title');
  // 도움말 버튼
  await cf.click('#mHelpClient [data-close]').catch(()=>{});
  await cf.click('#btnHelp'); ok(await cf.evaluate(()=>document.querySelector('#mHelpClient').classList.contains('open')),'client help button opens client help');
  // ===== 관리자: 로그아웃 → 로그인 화면 =====
  await op.click('#btnServer'); await op.click('#btnLogout'); await op.waitForTimeout(300);
  ok(await gateVisible(op),'logout shows admin login');
  await op.reload(); await op.waitForTimeout(300);
  ok(await gateVisible(op),'after logout + reload still requires login');
  // 토큰 만료 → refresh
  mock.setTokenTtl(1); await login(op,'admin',ADMIN.password); await op.waitForTimeout(100);
  mock.setTokenTtl(3600);
  const before=mock.log.filter(l=>l.path.includes('grant_type=refresh_token')).length;
  await op.click('#btnServer'); await op.click('#btnProjects'); await op.waitForSelector('.plist .p',{timeout:5000}).catch(()=>{});
  ok(mock.log.filter(l=>l.path.includes('grant_type=refresh_token')).length>before&&(await op.textContent('#plist')).includes('테스트 프로젝트'),'expired access token refreshed automatically');
  await op.screenshot({path:path.join(path.dirname(APP_FILE),'d_op.png')}); await cl.screenshot({path:path.join(path.dirname(APP_FILE),'d_client.png')});
  for(const [n,p] of [['op',op],['cl',cl],['cf',cf]])ok(!p.__errs.length,n+' page errors: '+p.__errs.join(' | '));
  console.log(failures?`\n${failures} FAILED`:'\nALL PASSED');
  await b.close(); process.exit(failures?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(1);});
