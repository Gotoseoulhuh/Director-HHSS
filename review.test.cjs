const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const htmlFile=fs.existsSync(path.join(__dirname,'index.html'))?'index.html':fs.readdirSync(__dirname).find(f=>f.endsWith('.html'));
const pageTitle=fs.readFileSync(path.join(__dirname,htmlFile),'utf8').match(/<title>(.*?)<\/title>/)[1];
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hhss-browser-'));
const chromePath = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p => fs.existsSync(p));
if (!chromePath) throw new Error('Chrome not found. Set CHROME=<path to chrome executable>.');
const browser = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--window-size=1440,1000','--remote-debugging-port=9227',
  '--auto-accept-this-tab-capture','--enable-usermedia-screen-capturing',`--auto-select-tab-capture-source-by-title=${pageTitle}`,`--auto-select-desktop-capture-source=${pageTitle}`,
  `--user-data-dir=${profile}`, 'http://127.0.0.1:8765/',
], { windowsHide: true, stdio: 'ignore' });
let ws;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  let tabs;
  for (let i = 0; i < 100; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9227/json')).json(); if (tabs.some(t => t.type === 'page')) break; } catch {}
    await delay(100);
  }
  if(!tabs)throw new Error('Headless browser did not start');
  ws = new WebSocket(tabs.find(t => t.url==='http://127.0.0.1:8765/')?.webSocketDebuggerUrl||tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const result = JSON.parse(event.data);
    if (pending.has(result.id)) { pending.get(result.id)(result); pending.delete(result.id); }
  });
  const call = (method, params) => new Promise((resolve,reject) => {const timer=setTimeout(()=>reject(Error('Browser call timed out: '+method)),30000); pending.set(++id, result=>{clearTimeout(timer);resolve(result)}); ws.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) {
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture:true });
    if (response.error || response.result.exceptionDetails) throw new Error(JSON.stringify(response));
    return response.result.result.value;
  }
  for(let i=0;i<100;i++){
    if(await evaluate("location.href==='http://127.0.0.1:8765/' && document.readyState==='complete'"))break;
    await delay(100);
  }
  await evaluate(`(async()=>{
    let html=await (await fetch('/')).text();
    html=html.replace('renderChips();renderSpeed();render();',
      'window.testApi={S,YtP,togglePlay,stepFrame,textKakao,selectMemo,openYouTube,createMemo,finishEdit,loadProject,projectData,reportHTML,render,setAnnotationTool,undoDelete,deleteMemo,parseYtId,setPlayer:p=>P=p};renderChips();renderSpeed();render();');
    document.open();document.write(html);document.close();
  })()`);
  const result = await evaluate(`(async()=>{
    const a=window.testApi;
    if(!a)throw Error('Application did not initialize');
    const check=(v,m)=>{if(!v)throw Error(m)};
    document.querySelector('#btnSource').click();
    check(document.querySelector('#sourceMenu').classList.contains('open'),'Source menu');
    document.querySelector('#btnYt').click();
    check(document.querySelector('#mYt').classList.contains('open'),'YouTube dialog');
    document.querySelector('[data-close]').click();
    check(a.parseYtId('https://youtu.be/M7lc1UVf-VE')==='M7lc1UVf-VE','YouTube URL parsing');
    let paused=false;
    a.setPlayer({ready:()=>true,time:()=>12,duration:()=>120,paused:()=>paused,pause:()=>paused=true,size:()=>({w:16,h:9}),snap:async()=>({t:12,thumb:''})});
    a.S.mode='file';a.S.videoName='test.mp4';
    const m=await a.createMemo({x:25,y:35});
    document.querySelector('#cText').value='Point note';a.finishEdit('save');
    check(m.t===12&&m.x===25&&m.text==='Point note','Point memo');
    check(a.textKakao().includes('X 25.0%, Y 35.0%'),'Kakao coordinates');
    check(document.querySelector('#btnPrev').textContent.includes('1프레임'),'Frame buttons');
    a.setAnnotationTool('draw');
    const overlay=document.querySelector('#overlay');
    overlay.style.cssText='display:block;position:absolute;left:0;top:0;width:640px;height:360px';
    // Synthetic pointer events cannot capture a physical pointer.
    overlay.setPointerCapture=()=>{};overlay.hasPointerCapture=()=>false;
    const event=(type,x,y)=>overlay.dispatchEvent(new PointerEvent(type,{pointerId:1,button:0,clientX:x,clientY:y,bubbles:true}));
    event('pointerdown',100,100);event('pointermove',160,130);event('pointermove',210,160);event('pointerup',220,170);
    await new Promise(r=>setTimeout(r,30));
    check(paused,'Drawing pauses playback');
    check(a.S.memos.length===2&&a.S.memos[1].strokes.length===1,'Drawing creates memo');
    event('pointerdown',100,110);event('pointermove',190,140);event('pointerup',220,180);
    await new Promise(r=>setTimeout(r,30));
    check(a.S.memos[1].strokes.length===2,'Multiple strokes');
    document.querySelector('#btnUndoStroke').click();
    check(a.S.memos[1].strokes.length===1,'Undo stroke');
    a.finishEdit('save');
    const data=JSON.parse(JSON.stringify(a.projectData()));
    a.loadProject(data,true);
    check(a.S.memos.length===2&&a.S.memos[1].strokes.length===1,'Project drawing roundtrip');
    check(document.querySelectorAll('#overlay polyline').length===1,'Drawing visible on video');
    check(a.reportHTML().includes('<polyline'),'HTML report retains drawing');
    const id=a.S.memos[1].id;a.deleteMemo(id);a.undoDelete();
    check(a.S.memos.some(m=>m.id===id&&m.strokes.length===1),'Delete undo retains drawing');
    return 'PASS: source menu, link dialog, URL parsing, point memo, pause on draw, multiple strokes, undo stroke, save/load, overlay, report, delete/undo';
  })()`);
  assert.ok(result.startsWith('PASS:'));
  console.log(result);
  if(process.argv.includes('--youtube')){
    await evaluate("testApi.setPlayer(null);testApi.openYouTube('M7lc1UVf-VE')");
    let state;
    for(let i=0;i<100;i++){
      state=await evaluate("({ready:testApi.YtP.ready(),duration:testApi.YtP.duration(),error:document.querySelector('#dropErr').textContent,title:document.querySelector('#ytTitle').textContent})");
      if(state.ready||state.error)break;
      await delay(200);
    }
    console.log('YouTube integration: '+JSON.stringify(state));
    assert.ok(state.ready&&state.duration>0,'YouTube must load and report video duration');
    await evaluate('testApi.YtP.play()');
    let playback;
    for(let i=0;i<75;i++){
      playback=await evaluate("({state:testApi.YtP._state,error:document.querySelector('#dropErr').textContent})");
      if(playback.state===1||playback.error)break;
      await delay(200);
    }
    assert.equal(playback.state,1,'YouTube must play: '+JSON.stringify(playback));
    await evaluate('testApi.YtP.pause();testApi.YtP.seek(10)');
    await delay(1500);
    console.log(await evaluate(`(async()=>{
      const a=testApi,m=await a.createMemo({x:40,y:50});
      if(!m||m.t<9.9||m.t>10.6||m.thumb!=='')throw Error('YouTube point memo must record time+position without capture '+JSON.stringify(m&&{t:m.t,thumb:m.thumb}));
      if(document.activeElement!==document.querySelector('#cText'))throw Error('Text box focused after pin');
      const f=document.querySelector('#ytFrame');if(!f||!(parseFloat(f.style.top)<0))throw Error('Player cropped (negative top) '+(f&&f.style.cssText));
      if(!document.querySelector('#ytShield'))throw Error('Pointer shield over player');
      a.finishEdit('save');
      a.setAnnotationTool('draw');
      const el=document.querySelector('#overlay'),r=el.getBoundingClientRect();
      for(const [type,x,y] of [['pointerdown',0.2,0.2],['pointermove',0.4,0.4],['pointerup',0.6,0.5]])
        el.dispatchEvent(new PointerEvent(type,{pointerId:1,button:0,clientX:r.left+r.width*x,clientY:r.top+r.height*y,bubbles:true}));
      await new Promise(r=>setTimeout(r,500));
      const drawn=a.S.memos.find(m=>m.strokes&&m.strokes.length&&m.t>9);
      if(!drawn)throw Error('YouTube link-only drawing');
      a.finishEdit('save');
      if(!a.textKakao().includes('X 40.0%, Y 50.0%'))throw Error('YouTube Kakao coordinates');
      if(!document.querySelector('.memo .thumb.yt'))throw Error('YouTube card shows position diagram');
      return 'PASS: live YouTube playback, pause, seek, point memo without capture, focus, cropped player, drawing, diagram card, coordinates';
    })()`));
    const t0=await evaluate('testApi.YtP.time()');
    await evaluate('testApi.stepFrame(1)');
    await delay(1200);
    console.log('frame step: '+t0+' → '+await evaluate('testApi.YtP.time()'));
    assert.ok(Math.abs(await evaluate('testApi.YtP.time()')-(t0+1/30))<0.05,'Frame step must advance 1/30s on YouTube');
  }
  // 유튜브 모드 키 매핑(가짜 플레이어): ← → 1프레임, Shift+← → 5초
  console.log(await evaluate(`(()=>{
    const a=testApi,Y=a.YtP;let t=12;const prev={player:Y.player,ready:Y._ready};
    Y.player={getCurrentTime:()=>t,seekTo:x=>{t=x;},pauseVideo(){},playVideo(){},getDuration:()=>100,getPlaybackRate:()=>1,destroy(){}};Y._ready=true;Y._target=null;
    a.setPlayer(Y);a.S.mode='yt';
    const key=(code,shift)=>document.body.dispatchEvent(new KeyboardEvent('keydown',{code,key:code==='ArrowLeft'?'ArrowLeft':'ArrowRight',shiftKey:!!shift,bubbles:true,cancelable:true}));
    key('ArrowRight');const t1=Y.time();
    if(Math.abs(t1-(12+1/30))>0.001)throw Error('YouTube → should step 1 frame: '+t1);
    key('ArrowRight');const t2=Y.time();
    if(Math.abs(t2-(12+2/30))>0.001)throw Error('Consecutive frame steps must accumulate (pending seek target): '+t2);
    key('ArrowLeft',true);const t3=Y.time();
    if(Math.abs(t3-(12+2/30-5))>0.001)throw Error('YouTube Shift+← should jump 5s: '+t3);
    Y.player=prev.player;Y._ready=prev.ready;Y._target=null;a.S.mode='file';
    return 'PASS: YouTube arrow keys = 1 frame, Shift = 5s, consecutive steps accumulate';
  })()`));
  const report=await evaluate('testApi.reportHTML()');
  for(const script of report.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(!script[0].includes('application/json'))new vm.Script(script[1]);
  }
  await evaluate(`document.open();document.write(${JSON.stringify(report)});document.close();`);
  console.log(await evaluate(`(()=>{
    if(!document.querySelector('#shotPreview .thumb'))throw Error('Report initial preview');
    document.querySelector('[data-select="1"]').click();
    if(!document.querySelector('#shotLabel').textContent.includes('2번'))throw Error('Report point selection');
    document.querySelector('#prevSlide').click();
    if(!document.querySelector('#shotLabel').textContent.includes('1번'))throw Error('Previous slide');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    if(!document.querySelector('#shotLabel').textContent.includes('2번'))throw Error('Keyboard next slide');
    document.querySelector('#commentAuthor').value='검토자';
    document.querySelector('#commentText').value='검토 댓글 <script>literal</'+'script>';
    document.querySelector('#commentForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    if(document.querySelector('#commentCount').textContent!=='1')throw Error('Comment count');
    if(!document.querySelector('#commentList').textContent.includes('검토 댓글'))throw Error('Comment display');
    if(document.querySelector('#commentList script'))throw Error('Comment HTML injection');
    document.querySelector('#prevSlide').click();
    if(document.querySelector('#commentCount').textContent!=='0')throw Error('Comments belong to individual slides');
    document.querySelector('#nextSlide').click();
    if(document.querySelector('#commentCount').textContent!=='1')throw Error('Comment preserved after slide change');
    return 'PASS: slideshow layout, film roll, previous/next, keyboard navigation, comments per slide, comment escaping, excerpt controls';
  })()`));
  const saved=await evaluate(`(async()=>{
    HTMLAnchorElement.prototype.click=function(){window.savedUrl=this.href;};
    document.querySelector('#saveReport').click();
    return await (await fetch(window.savedUrl)).text();
  })()`);
  const savedData=JSON.parse(saved.match(/<script type="application\/json" id="vreview-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(savedData.memos[1].comments.length,1,'Downloaded report includes comments');
  for(const script of saved.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(!script[0].includes('application/json'))new vm.Script(script[1]);
  }
  await evaluate(`localStorage.clear();document.open();document.write(${JSON.stringify(saved)});document.close();`);
  console.log(await evaluate(`(()=>{
    document.querySelector('[data-select="1"]').click();
    if(document.querySelector('#commentCount').textContent!=='1')throw Error('Saved HTML comments must survive without browser cache');
    return 'PASS: comments embedded in downloaded HTML and restored in fresh browser storage';
  })()`));
  if(process.argv.includes('--screenshot')){
    await evaluate(`(()=>{
      const images=document.querySelectorAll('.film-item img');
      if(images.length)images[images.length-1].closest('button').click();
    })()`);
    await delay(400);
    const capture=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('review-preview.png',Buffer.from(capture.result.data,'base64'));
    console.log('Saved review-preview.png');
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  if (ws) ws.close();
  browser.kill();
});
