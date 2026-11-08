# Director's Board · HHSS — 개발 인수인계

갱신: 2026-11-07 (한국 시간) · 앱 버전: index.html v2 (프로젝트 JSON `version: 4`)

## 먼저 확인할 것

- 이 폴더는 **동작하는 앱 전체**입니다. GitHub Pages에 배포되어 있고(아래 주소), 서버 연결 코드와 SQL도 들어 있지만 **실제 Supabase 프로젝트에는 아직 연결하지 않았습니다** (URL·anon 키를 아직 받지 못함). 그 전까지 배포본은 로그인 화면에서 '서버 없이 이 PC에서만 쓰기'만 가능. 연결 절차는 `SETUP.md`.
- 서버 연결 코드는 Supabase(PostgREST)와 같은 규칙을 구현한 **모의 서버**(`tests/mock_supabase.js`)로 검증했습니다. 실제 서버에서 첫 연결 테스트와 메모 왕복 1회는 운영자가 확인해야 합니다.
- GitHub 저장소: https://github.com/Gotoseoulhuh/Director-HHSS (2026-11-07 푸시). GitHub Pages: https://gotoseoulhuh.github.io/Director-HHSS/ — `.github/workflows/pages.yml`이 main 푸시마다 자동 배포.
- 이전 버전(ver1.1)과의 호환: 프로젝트 JSON(v3)·공유 HTML은 그대로 읽힙니다. 불러올 때 메모 id를 **유지**합니다(이전에는 새로 만들었음).

## 2026-11-08 추가 (관리자 장면 캡처)

유튜브 썸네일이 필요하다는 요청으로 **관리자 전용·직접 켤 때만** 탭 캡처를 되살림(`Grab`). `getDisplayMedia({preferCurrentTab:true,...})`, 브라우저 탭이 아니면 거절. 켜져 있으면 `YtP.snap()`이 멈춘 뒤 `#overlay` 영역만 잘라 960px JPEG(핀·그림은 `#stage.capturing`으로 숨김). `fillThumbs()`는 썸네일 없는 메모마다 seek → 버퍼링 끝 대기 → 캡처 → `changed(m)`로 서버 반영. 클라이언트에는 버튼 없음(`.op-only`). Space 흔들림의 원인이었던 '멈출 때마다 공유 요청'은 없음.

## 2026-11-08 변경 (관리자/클라이언트 분리)

| 요청 | 상태 | 비고 |
|---|---|---|
| 관리자 로그인 | ✅ | Supabase Auth 이메일+비밀번호(REST `/auth/v1/token`, supabase-js 없음) → `Auth` 모듈(세션 localStorage/sessionStorage, 만료 60초 전 refresh). 아이디에 @가 없으면 `@hhss.studio`를 붙임. `public.operators`에 등록된 사용자만 `is_operator()`=true. 로그인 화면 `#gate`(관리자/클라이언트 공용), `bootAdmin()`. 서버 미설정 빌드는 "서버 없이 이 PC에서만 쓰기"(`hhss:localOnly`) |
| 클라이언트 로그인 | ✅ | 프로젝트마다 아이디·비밀번호. `rpc/set_client_credentials`(관리자만, bcrypt 해시 + 토큰 재발급) / `rpc/client_login`(맞으면 토큰, 틀리면 1초 지연 후 null) / `rpc/client_project`(토큰 헤더가 맞을 때 프로젝트 정보). 링크는 `#p=<id>`만, 동봉 HTML에도 토큰 없음. 토큰은 `hhss:client:<pid>`에 보관(재방문 시 로그인 생략), 비번 재설정 시 끊김 → 다시 로그인하면 화면·메모 유지 |
| 클라이언트 화면 | ✅ | `.op-only` 숨김(대상 영상·프로젝트 열기/저장·서버·⚙), `#btnSend` '빠른 수정 요청'(primary, 안 보낸 개수), 내보내기는 흰 버튼, `#btnHelp` 텍스트 '도움말' → `#mHelpClient`(5단계 안내, 첫 로그인 때 1회 자동) |
| 버튼 눌러야 전송 | ✅ | `Sync.manual`(클라이언트): enqueue는 큐에만, 자동 flush·재시도 없음. `sendRequests()`가 이름 확인 후 `flush()`; 실패 401/403이면 `authLost` → 재로그인. 큐는 IndexedDB에 남아 새로고침·창 닫기에도 유지 |
| SQL v2 | ✅ 파일 | `operators`, `projects.client_login/client_pw_hash`, projects는 관리자(authenticated+is_operator)만, anon은 projects 직접 접근 불가, `app_config`(운영자 키) 삭제 |

검증: `tests/t_sync.js` 전면 개편(관리자 로그인 실패/비관리자/성공·유지·로그아웃·토큰 갱신, 클라이언트 로그인 실패/성공(대소문자 무시)·메뉴 숨김·버튼 색, 누르기 전 미전송·이름 요구·전송·작성자, 오프라인 실패 후 재전송, 새로고침 유지, 비번 재설정→재로그인, 보관 시 로그인 거부, 동봉 HTML 로그인), `t_dboard1`·`review.test.cjs`·가짜 유튜브 점검 모두 통과. 실제 Supabase에서는 아직 미검증.

## 2026-11-07 변경 (탭 캡처 제거 등)

| 요청 | 상태 | 비고 |
|---|---|---|
| 유튜브: 화면 공유(탭 캡처) 없이 동작 | ✅ | `Cap` 모듈·`getDisplayMedia`·정지 화면(`#freezeFrame`)·`cleanPause` 전부 삭제. 유튜브 메모는 `thumb:''`로 **시간·핀 위치·그림만 기록**. 카드·작성 칸은 영상 비율의 **위치 도식**(`.thumb.none.yt`, 3등분 선 + 핀) |
| 유튜브 임베드 정리 | ✅ | 플레이어 iframe을 영상 그림 영역보다 위아래로 `ytPad(h)`(높이의 28%, 90~200px)만큼 크게 두고 `#yt{overflow:hidden}`으로 잘라냄 → 일시정지 때 뜨는 유튜브 제목 띠·하단 로고가 그림과 겹치지 않음(그림은 전부 보임). `#ytShield`가 플레이어로 가는 마우스 이벤트를 막아 유튜브 자체 UI가 뜨지 않음. `layoutOverlay()`가 iframe 위치도 계산 |
| 공유 보고서(HTML)의 유튜브 장면 | ✅ | 웹 주소(https)로 연 보고서는 장면 자리에 **유튜브 플레이어를 임베드**(IFrame API, 같은 크롭 방식)하고 핀·그림을 오버레이. "▶ 이 장면 보기" → 그 시점에서 멈춤, 슬라이드 이동 시 `seekTo`, "앞뒤 3초 재생", Space/클릭으로 재생·정지. 파일(file://)로 열면 유튜브가 재생을 거부하므로 도식 + "유튜브에서 보기" 링크로 대체. 필름 롤·인쇄는 도식 |
| 비율 선택 제거(자동만) | ✅ | 링크 창의 비율 선택 상자 삭제. `detectYtAspect()` 결과만 사용(`S.ytAspect`). 감지 실패 시 16:9 가정 + 안내. 예외용으로 YouTube 줄의 비율 표시(`#ytAspectInfo`)를 클릭하면 16:9→9:16→4:3→1:1→자동 순환(`S.ytAspectManual`, 그 영상/프로젝트에만 저장, 설정에 저장하지 않음) |
| 유튜브 방향키 | ✅ | 유튜브 모드: `← →` = 1프레임(`stepFrame`, 기본 FPS 기준 근사), `Shift+← →` = 5초. 영상 파일 모드는 그대로(5초/Shift 1초). `, .`은 양쪽 모두 1프레임. `YtP.seek()`가 요청 시각을 `_target`으로 기억하고 `time()`이 플레이어가 따라올 때까지 그 값을 돌려줘 **연타해도 누적**됨(IFrame API의 `getCurrentTime()`은 seek 직후 옛값을 주기 때문) |
| 핀·그리기 직후 바로 입력 | ✅ | `startEdit()`가 항상 `focusText()` (이전엔 새 메모면 blur). 그리기 획을 기존 메모에 추가할 때도 포커스. 입력 중 문구 넣기는 **Alt+Q/W/E/R**(한/영 입력 상태와 무관, IME 229 문제 회피) 또는 문구 버튼 클릭. 입력칸 밖에서는 Q/W/E/R 그대로. `Tab`은 입력칸에서 잠시 나가기(단축키 모드) |
| Space 흔들림 / 일시정지 제목 겹침 | ✅ | 원인: 유튜브에서 Space로 멈출 때마다 `ensureCapture()`가 화면 공유 선택창을 띄우고, 공유가 켜지면 크롬 상단에 공유 알림 띠가 생겨 페이지가 아래로 밀렸다가 돌아옴 + `cleanPause`가 0.25배속으로 잠깐 재생. 캡처 제거로 해결. `keyup` Space도 `preventDefault`(포커스된 버튼 재클릭·스크롤 방지). 제목 겹침은 유튜브 플레이어 자체의 일시정지 UI → 위 크롭으로 숨김 |

검증: `tests/t_dboard1.js`(입력칸 포커스, Alt+Q, 파일 모드 방향키 유지, Space 레이아웃 불변), `review.test.cjs`(가짜 플레이어로 유튜브 방향키 1프레임·Shift 5초·연타 누적), 가짜 `YT.Player`를 주입한 Playwright 점검(크롭 레이아웃, 실드, 비율 표시 순환, 도식 카드, 보고서 임베드/파일 대체 경로) 모두 통과. **실제 유튜브 재생 화면은 이 작업 환경에서 열 수 없어 운영자가 Pages 주소에서 확인해야 함** — 특히 일시정지 때 유튜브의 "다른 동영상" 추천 띠가 남는지.

## 이번에 구현한 것 (2026-11-06)

| 요청 | 상태 | 비고 |
|---|---|---|
| 핀 드래그 이동 | ✅ | `pointerdown/move/up` on `#overlay .pin`, 4px 이상 움직이면 드래그, 영상 그림 영역 기준 % 좌표, 드래그 뒤 click 억제(`suppressClickAt`), 터치/`pointercancel` 처리, 카드·캡처·내보내기·자동 저장·서버 반영 |
| 핀 우클릭 삭제 | ✅ | `removePoint()`: 포인트만 제거(x,y=null), 글·그림·캡처 유지. 남는 게 없으면 `deleteMemo()`. 둘 다 Ctrl+Z 되돌리기 |
| 되돌리기 일반화 | ✅ | `S.undo` 항목이 `{type:'memo'|'move'|'point'}` — `pushUndo()`, `undoDelete()` |
| FPS 자동 판별 | ✅ | `detectFpsFromFile()`: moov→trak(vide)→mdhd timescale + stts. 단일 간격(≥98%)이면 정확값, 아니면 평균+"가변 프레임". 파싱 불가(webm 등)는 `Measure`(rVFC)로 재생 중 측정 "≈". 유튜브는 `source:'youtube'` → "알 수 없음 · 기본값 기준" 표시. `effectiveFps()`가 프레임 이동·프레임 표시에 쓰임. 재생 바의 선택 상자로 직접 지정(`S.fpsOverride`) |
| 운영자/클라이언트 분리 | ✅ | `CLIENT` 감지(`#r=<uuid>.<token>` 또는 `<script id="hhss-client-config">`) → `startClient()`. 운영자 전용 UI는 `.op-only`, 클라이언트는 `body.client` |
| 클라이언트 검수 링크/HTML 생성 | ✅ | `createProject()` → projects 행 + 토큰. 링크 `appUrl#r=id.token`, 동봉용 HTML은 `clientHtml()`이 `PRISTINE`(로드 시점 원본)에 설정 스크립트를 끼워 생성 |
| 서버 자동 저장 | ✅ | `Sync`: 행 단위 upsert(`on_conflict=id`, `merge-duplicates`), soft delete(`deleted_at`), rev 기반 충돌 해결, 미전송 큐를 IndexedDB(`hhss:pending:<pid>`)에 보존, 재시도 백오프, 상태 칩 5종. 운영자 8초/클라이언트 15초 폴링 `pull()`+`merge()` |
| 운영자 확인 화면 | ✅ | 서버 ▾ → 서버 프로젝트 열기(`loadProjects()`/`openServerProject()`), 카드에 작성자 배지, 댓글 수 |
| SQL/RLS | ✅ 파일만 | `supabase/schema.sql`: 테이블 3개, `is_operator()`(bcrypt 해시 비교, security definer), `has_project_token()`, 정책, 크기 제한 |
| 기존 보고서·필름 롤·댓글 HTML | ✅ 유지 | `reportHTML()` 변경 없음 |
| 유튜브 비율 자동 감지 | ✅ | `detectYtAspect()`: oEmbed(youtube.com → noembed.com 프록시) width/height, 세로 전용 썸네일 `vi/ID/oar2.jpg` 크기. 실패 시 16:9 가정 + 안내. (11-07: 링크 창의 선택 상자는 없앴고, 예외 시 비율 표시 클릭으로 바꿈 → `S.ytAspectManual`) 프로젝트/클라이언트에는 감지된 비율이 전달됨 |
| 유튜브 스크립트 로딩 진단 | ✅ | `loadYtApi()`가 youtube.com → youtube-nocookie.com 순서로 시도, 실패 원인(script-blocked / api-timeout)과 현재 주소를 표시, 다시 시도 버튼 |
| 자동 저장 용량 | ✅ | localStorage(5MB) → IndexedDB(`KV`). 썸네일 뺀 경량 사본은 localStorage `:lite`에 백업 |
| 유튜브에서 캡처 거부 시 | — | (11-07에 탭 캡처 자체를 없앰. 유튜브 메모는 항상 썸네일 없이 시간·위치만 기록) |
| HEVC/재생 불가 안내 | ✅ 유지 | 코덱 스니핑(`sniffCodec`) + 안내문 |

## 아직 하지 않은 것 / 알려진 한계

- **실제 Supabase 연결** — Pages 배포는 끝남. Supabase는 운영자가 SETUP 1~2를 진행하고 URL·anon 키를 `SERVER_DEFAULT`에 채워야 클라이언트 링크 저장이 동작함. 운영자 키는 절대 파일에 넣지 않음.
- **댓글 서버 동기화** — `comments` 테이블과 읽기(`select=*,comments(*)`)는 준비됐지만, 앱은 아직 댓글을 서버에 **쓰지 않습니다**. 공유 보고서의 댓글은 그 HTML/브라우저에만 남습니다.
- **유튜브 일시정지 UI** — 제목 띠는 크롭으로 숨겼지만, 유튜브가 일시정지 때 플레이어 안쪽에 띄우는 "다른 동영상" 추천 띠는 공식적으로 끌 수 없음. 실제 화면에서 남는다면 `ytPad()`를 키우거나(아래쪽을 더 잘라냄) 일시정지 중 플레이어 위에 반투명 안내를 덮는 방식을 검토.
- **썸네일 저장 위치**(파일 프로젝트만 해당) — DB text 컬럼(base64, 행당 ≤1.2MB). 규모가 커지면 Supabase Storage(버킷 `thumbs`, 경로 `project_id/annotation_id.jpg`)로 옮기고 `annotations.thumb_path` 추가 + Storage RLS를 써야 함. 토큰 헤더가 Storage API까지 전달되는지는 별도 확인 필요해서 이번에는 DB에 넣었음.
- **운영자 인증** — 11-08부터 Supabase Auth + `operators` 표. 관리자를 늘리려면 사용자 추가 후 `operators`에 insert.
- **클라이언트 로그인 시도 제한** — 실패 시 1초 지연만 있음(계정 잠금 없음). 자동 생성 8자 비밀번호 권장.
- **실시간** — 폴링. Supabase Realtime을 쓰려면 supabase-js(CDN) 추가 필요.
- **유튜브 FPS** — IFrame API 한계로 원본 FPS 불가. 임의값을 "자동 감지"로 표시하지 않음. YouTube Data API `fileDetails`는 영상 소유자 OAuth가 필요해 일반 링크에는 쓸 수 없음.
- **유튜브 + file://** — 재생 거부(referrer 없음). 클라이언트 HTML(동봉용)은 파일 프로젝트에만 권장.
- **`confirm()` 사용** — 자동 저장 복원·메모 비우기·프로젝트 전환에 브라우저 confirm을 씀. 다이얼로그가 막힌 환경(일부 임베드)에선 자체 UI로 바꿔야 함.
- **CDP 테스트(`review.test.cjs`)** — 통과하지만 서버 동기화·드래그·FPS는 검사하지 않음. 그 부분은 `tests/`의 Playwright 검사가 담당(선택 설치).

## 코드 지도 (`index.html`, 줄 번호는 현재 버전 기준)

| 줄 | 구역 | 핵심 이름 |
|---|---|---|
| 9~ | CSS | `.pin`, `.sync`(상태 칩), `body.client .op-only`, `.fps`, `.plist` |
| ~145 | 헤더 | `#authorWrap`(클라이언트 이름), `#syncChip`, `#sourceMenu`, `#serverMenu` |
| ~230 | 모달 | `#mYt`, `#mServer`(서버 설정), `#mProject`(검수 만들기), `#mProjects`(목록), `#mSettings`, `#mHelp` |
| 391 | 유틸 | `fmt`, `toast`, `download`, `copyText`, `parseYtId` |
| 445 | FPS 판별 | `STD_FPS`, `snapFps`, `effectiveFps`, `setFps/renderFps`, `detectFpsFromFile`, `Measure` |
| 539 | 파일 플레이어 | `FileP`, `sniffCodec`, `openVideo`, HEVC 안내 |
| 620 | 유튜브 | `YtP`(`_target` 기반 time/seek), `loadYtApi`, `ytLoadFailMsg`, 비율 `detectYtAspect/applyYtAspect/cycleYtAspect`, `openYouTube`(`#ytFrame`+`#ytShield`), `ytPad` |
| 781 | 시간 루프 | `renderPins`(드래그 중 재렌더 금지), `tick`, `togglePlay`, `stepFrame` |
| 813 | 메모 | `changed()`(rev↑·자동 저장·서버 큐), `pushUndo`, `createMemo`, `startEdit/finishEdit`, `removePoint`, `movePoint`, `deleteMemo`(soft), `undoDelete`, `render` |
| 945 | 저장 | `autoKey`, `KV`(IndexedDB), `restoreAutosaveIfAny`, `projectData`(`remote` 포함), `autosave`, `loadProject`(id 유지) |
| 1022 | 내보내기 | `textKakao`, `textNotion`, `reportHTML`(슬라이드 보고서), `doExport` |
| 1145 | 서버 | `SERVER_DEFAULT`, `PRISTINE`, `CLIENT`, `Sync`, `renderSync`, `attachRemote`, `clientLink`, `clientHtml`, 서버 설정/프로젝트 만들기/목록/열기, `startClient` |
| 1430 | 모달·이벤트 | `openSettings`, `submitYt`, 핀 드래그(`pointerdown/move/up/cancel`, `endDrag`), `contextmenu`, 그리기 제스처, 단축키 |
| 끝 | `window.__hhss()` | 테스트·디버깅용 내부 상태 접근 |

## 데이터 형식

**메모(annotation)** — 앱 내부와 서버 행이 같은 필드:
`id`(text, 앱 생성, 불변) · `t`(초) · `x`,`y`(% 또는 null) · `text` · `strokes`(획 배열) · `thumb`(data URL) · `verdict`(예약) · `author` · `rev`(수정 번호) · `created`/`created_at` · `updated`/`updated_at` · `deleted`/`deleted_at` · `comments[]`(읽기 전용)

**프로젝트 JSON(v4)** — `projectData()`: `{app,version:4,title,video{name,size,duration,youtubeId?,aspect?},remote?{projectId,title,source},fps,fpsInfo{value,source,detail,vfr},memos[],savedAt}`

**서버 접근** — 모든 요청에 `apikey`. 관리자는 `Authorization: Bearer <사용자 JWT>`(RLS: `is_operator()` = `operators`에 `auth.uid()` 존재), 클라이언트는 `Authorization: Bearer <anon>` + `x-review-token`(RLS가 `request.headers`로 읽음). 클라이언트는 projects 표를 직접 못 읽고 RPC로만 접근.

## 검증 방법

```powershell
node review-server.cjs --no-browser
node review.test.cjs                 # CDP 회귀 (Windows/Mac/Linux, CHROME= 로 경로 지정)
```
Playwright(선택, `npm i playwright`): `tests/t_dboard1.js`(FPS 30/25/29.97/faststart/webm 측정, 1프레임 이동, 드래그·우클릭·되돌리기, 새로고침 후 id 유지), `tests/t_sync.js`(서버 설정 테스트, 프로젝트 생성, 링크 형식, 업로드/수정 rev/삭제/복구, 클라이언트 링크·동봉 HTML, 토큰 헤더, 작성자 배지, 오프라인→재전송, 새로고침 후 미전송 큐 유지, 잘못된 토큰, 운영자 재열기). 두 검사 모두 `--no-sandbox` 헤드리스 크롬 기준이며 Chrome 경로는 파일 상단에서 수정.

## 다음 작업 제안 (우선순위)

1. 운영자가 SETUP 1~4 수행 → 실제 Supabase에서 연결 테스트·왕복 확인 → 문제 있으면 `Sync.rest()` 응답 코드로 진단.
2. 댓글 서버 쓰기(`comments` upsert + 앱 내 댓글 입력) — 보고서 HTML의 댓글과 통합.
3. 썸네일 Storage 이전(규모 커질 때).
4. 컷별 판정(통과/수정/삭제, 숫자키 1~4) — `verdict` 필드와 단축키 예약됨.
5. 고객용 사용 설명서(A4 2쪽, 별도 디자인 캔버스로 제작됨)를 링크 기반 흐름으로 갱신 (탭 캡처 문구 삭제 포함).
6. 방향키 1프레임 이동을 영상 파일 모드에도 적용할지 운영자와 결정 (지금은 유튜브 모드만).
