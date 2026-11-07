// 선택 검사: npm i playwright 후 node tests/t_dboard1.js  (CHROME=크롬경로)
const { chromium } = require('playwright'); const path=require('path');
const APP='file://'+require('path').resolve(__dirname,'..','index.html');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--mute-audio','--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:1400,height:860}}); const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  page.on('dialog',d=>d.accept());
  const fail=(m)=>{console.log('FAIL:',m);process.exitCode=1;};
  const ok=(c,m)=>c?console.log('ok  -',m):fail(m);
  await page.goto(APP); await page.evaluate(()=>{localStorage.clear();indexedDB.deleteDatabase('hhss-review');});
  const openFile=async(f)=>{await page.setInputFiles('#fileVideo',f);await page.waitForFunction(()=>document.querySelector('#video').videoWidth>0);await page.waitForTimeout(400);};
  const fpsInfo=()=>page.textContent('#fpsInfo');
  // --- FPS: metadata
  await openFile(path.join(__dirname,'media','test.mp4')); await page.waitForTimeout(300);
  ok((await fpsInfo()).startsWith('30fps · 파일 정보'),'fps meta 30: '+await fpsInfo());
  await openFile(path.join(__dirname,'media','t25.mp4')); await page.waitForTimeout(300);
  ok((await fpsInfo()).startsWith('25fps · 파일 정보'),'fps meta 25: '+await fpsInfo());
  await openFile(path.join(__dirname,'media','t2997.mp4')); await page.waitForTimeout(300);
  ok((await fpsInfo()).startsWith('29.97fps · 파일 정보'),'fps meta 29.97: '+await fpsInfo());
  await openFile(path.join(__dirname,'media','t30fast.mp4')); await page.waitForTimeout(300);
  ok((await fpsInfo()).startsWith('30fps · 파일 정보'),'fps meta faststart 30: '+await fpsInfo());
  // HEVC file: picture missing → still parses meta? (hevc sample from user has hvc1; fps should parse too)
  await openFile_noWait();
  async function openFile_noWait(){}
  // --- FPS: measured (webm)
  await page.setInputFiles('#fileVideo',path.join(__dirname,'media','t24.webm'));
  await page.waitForFunction(()=>document.querySelector('#video').videoWidth>0); await page.waitForTimeout(400);
  ok((await fpsInfo()).startsWith('FPS 측정 중'),'webm before play: '+await fpsInfo());
  await page.keyboard.press('Space'); await page.waitForTimeout(3600);
  ok((await fpsInfo()).startsWith('≈24fps · 재생 측정'),'webm measured 24: '+await fpsInfo());
  // manual override
  await page.selectOption('#frameFps','60'); await page.waitForTimeout(100);
  ok((await fpsInfo()).includes('60 · 직접 지정'),'override 60: '+await fpsInfo());
  await page.selectOption('#frameFps','auto'); await page.waitForTimeout(100);
  ok((await fpsInfo()).startsWith('≈24fps'),'back to auto: '+await fpsInfo());
  // --- stepFrame uses effective fps: 30fps file → 1/30
  await openFile(path.join(__dirname,'media','test.mp4')); await page.waitForTimeout(300);
  await page.evaluate(()=>{document.querySelector('#video').currentTime=1;}); await page.waitForTimeout(300);
  await page.keyboard.press('Period'); await page.waitForTimeout(300);
  const t1=await page.evaluate(()=>document.querySelector('#video').currentTime);
  ok(Math.abs(t1-(1+1/30))<0.01,'step frame = 1/30 → '+t1.toFixed(4));
  // --- pins: create, drag, right-click
  await page.evaluate(()=>{document.querySelector('#video').currentTime=2;}); await page.waitForTimeout(300);
  const ob=await page.locator('#overlay').boundingBox();
  await page.mouse.click(ob.x+ob.width*0.30, ob.y+ob.height*0.40); await page.waitForTimeout(250);
  await page.keyboard.press('q'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  let m=await page.evaluate(()=>JSON.parse(JSON.stringify(window.__S?window.__S.memos:null)));
  // expose S via a tiny hook: read from autosave instead
  const memos=async()=>{const d=await page.evaluate(()=>new Promise(r=>{const q=indexedDB.open('hhss-review',1);q.onsuccess=()=>{const t=q.result.transaction('kv','readonly').objectStore('kv');const g=t.getAll();g.onsuccess=()=>r(g.result);};}));return d.flatMap(x=>x.memos||[]);};
  await page.waitForTimeout(600);
  let ms=await memos(); ok(ms.length===1&&Math.abs(ms[0].x-30)<1&&Math.abs(ms[0].y-40)<1&&ms[0].rev===1,'memo created x30 y40 rev1: '+JSON.stringify(ms.map(k=>[k.x,k.y,k.rev])));
  // drag pin from (30%,40%) to (60%,70%)
  const pin=await page.locator('#overlay .pin').first().boundingBox();
  ok(!!pin,'pin visible after save (paused+selected)');
  await page.mouse.move(pin.x+pin.width/2,pin.y+pin.height/2); await page.mouse.down();
  await page.mouse.move(ob.x+ob.width*0.45, ob.y+ob.height*0.55,{steps:5});
  await page.mouse.move(ob.x+ob.width*0.60, ob.y+ob.height*0.70,{steps:5});
  await page.mouse.up(); await page.waitForTimeout(700);
  ms=await memos(); ok(ms.length===1&&Math.abs(ms[0].x-60)<1.5&&Math.abs(ms[0].y-70)<1.5&&ms[0].rev===2,'dragged to x60 y70 rev2 (no new memo): '+JSON.stringify(ms.map(k=>[k.x,k.y,k.rev])));
  const cardPos=await page.evaluate(()=>document.querySelector('.memo .pin').getAttribute('style'));
  ok(/left:\s*6\d(\.\d+)?%/.test(cardPos),'card thumbnail pin moved: '+cardPos);
  // undo move
  await page.keyboard.press('Control+z'); await page.waitForTimeout(600);
  ms=await memos(); ok(Math.abs(ms[0].x-30)<1&&Math.abs(ms[0].y-40)<1,'undo restores x30 y40: '+JSON.stringify([ms[0].x,ms[0].y]));
  // right-click removes point only
  const pin2=await page.locator('#overlay .pin').first().boundingBox();
  await page.mouse.click(pin2.x+pin2.width/2,pin2.y+pin2.height/2,{button:'right'}); await page.waitForTimeout(600);
  ms=await memos(); ok(ms.length===1&&ms[0].x==null&&ms[0].text==='컷 더 잘라주세요','point removed, text kept: '+JSON.stringify([ms[0].x,ms[0].text]));
  ok((await page.textContent('.memo .flag')).includes('메모'),'card flag shows 메모');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(600);
  ms=await memos(); ok(ms[0].x!=null,'undo restores point: x='+ms[0].x);
  // right-click on a memo with no text → deletes memo (soft) and undo brings back
  await page.evaluate(()=>{document.querySelector('#video').currentTime=4;}); await page.waitForTimeout(300);
  await page.mouse.click(ob.x+ob.width*0.5, ob.y+ob.height*0.5); await page.waitForTimeout(250);
  await page.keyboard.press('Escape'); // cancel → new empty memo removed entirely
  await page.waitForTimeout(200);
  await page.mouse.click(ob.x+ob.width*0.5, ob.y+ob.height*0.5); await page.waitForTimeout(250);
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(200); // save with empty text (pin only)
  ok((await page.textContent('#count'))==='2','pin-only memo saved (count 2)');
  const pin3=await page.locator('#overlay .pin.sel').first().boundingBox();
  await page.mouse.click(pin3.x+pin3.width/2,pin3.y+pin3.height/2,{button:'right'}); await page.waitForTimeout(600);
  ok((await page.textContent('#count'))==='1','pin-only memo deleted by right-click');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
  ok((await page.textContent('#count'))==='2','undo restores deleted memo');
  // reload → autosave restore from IndexedDB (dialog auto-accept) keeps ids
  await page.waitForTimeout(800);const idsBefore=(await memos()).map(k=>k.id).sort();
  await page.reload(); await openFile(path.join(__dirname,'media','test.mp4')); await page.waitForTimeout(500);
  const idsAfter=(await memos()).map(k=>k.id).sort();
  ok(JSON.stringify(idsBefore)===JSON.stringify(idsAfter)&&idsAfter.length===2,'ids stable across reload: '+idsAfter.join(','));
  await page.screenshot({path:path.join(__dirname,'d1.png')});
  console.log('errors:',errs);
  await b.close();
})().catch(e=>{console.error('CRASH',e);process.exit(1);});
