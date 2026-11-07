# Director's Board · HHSS — 개발 인수인계

갱신: 2026-11-07 (한국 시간) · 앱 버전: index.html v2 (프로젝트 JSON `version: 4`)

## 먼저 확인할 것

- 이 폴더는 **동작하는 앱 전체**입니다. 서버 연결 코드와 SQL까지 들어 있지만, **실제 Supabase 프로젝트와 GitHub Pages에는 아직 연결·배포하지 않았습니다** (운영자의 URL·anon 키를 아직 받지 못함). 연결 절차는 `SETUP.md`.
- 서버 연결 코드는 Supabase(PostgREST)와 같은 규칙을 구현한 **모의 서버**(`tests/mock_supabase.js`)로 검증했습니다. 실제 서버에서 첫 연결 테스트와 메모 왕복 1회는 운영자가 확인해야 합니다.
- GitHub 저장소: https://github.com/Gotoseoulhuh/Director-HHSS (2026-11-07 푸시). GitHub Pages: https://gotoseoulhuh.github.io/Director-HHSS/ — `.github/workflows/pages.yml`이 main 푸시마다 자동 배포.
- 이전 버전(ver1.1)과의 호환: 프로젝트 JSON(v3)·공유 HTML은 그대로 읽힙니다. 불러올 때 메모 id를 **유지**합니다(이전에는 새로 만들었음).

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
| 유튜브 비율 자동 감지 | ✅ | `detectYtAspect()`: oEmbed(youtube.com → noembed.com 프록시) width/height, 세로 전용 썸네일 `vi/ID/oar2.jpg` 크기. 실패 시 16:9 가정 + 안내. 링크 창에서 직접 지정하면 우선(`S.settings.ytAspect`, 'auto' 기본). 프로젝트/클라이언트에는 감지된 비율이 전달됨 |
| 유튜브 스크립트 로딩 진단 | ✅ | `loadYtApi()`가 youtube.com → youtube-nocookie.com 순서로 시도, 실패 원인(script-blocked / api-timeout)과 현재 주소를 표시, 다시 시도 버튼 |
| 자동 저장 용량 | ✅ | localStorage(5MB) → IndexedDB(`KV`). 썸네일 뺀 경량 사본은 localStorage `:lite`에 백업 |
| 유튜브에서 캡처 거부 시 | ✅ | 이전엔 메모 자체가 안 만들어졌음 → 이제 썸네일 없이 만들어지고 안내 토스트 |
| HEVC/재생 불가 안내 | ✅ 유지 | 코덱 스니핑(`sniffCodec`) + 안내문 |

## 아직 하지 않은 것 / 알려진 한계

- **실제 Supabase 연결** — Pages 배포는 끝남. Supabase는 운영자가 SETUP 1~2를 진행하고 URL·anon 키를 `SERVER_DEFAULT`에 채워야 클라이언트 링크 저장이 동작함. 운영자 키는 절대 파일에 넣지 않음.
- **댓글 서버 동기화** — `comments` 테이블과 읽기(`select=*,comments(*)`)는 준비됐지만, 앱은 아직 댓글을 서버에 **쓰지 않습니다**. 공유 보고서의 댓글은 그 HTML/브라우저에만 남습니다.
- **썸네일 저장 위치** — DB text 컬럼(base64, 행당 ≤1.2MB). 규모가 커지면 Supabase Storage(버킷 `thumbs`, 경로 `project_id/annotation_id.jpg`)로 옮기고 `annotations.thumb_path` 추가 + Storage RLS를 써야 함. 토큰 헤더가 Storage API까지 전달되는지는 별도 확인 필요해서 이번에는 DB에 넣었음.
- **운영자 인증** — 공유 비밀(운영자 키) 모델. 여러 운영자/감사 로그가 필요하면 Supabase Auth(매직 링크)로 교체: `is_operator()`를 `auth.uid()` 기반으로 바꾸고 앱에 로그인 UI 추가.
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
| 620 | 유튜브 | `YtP`(cleanPause 포함), `openYouTube`, `YT_FILE_MSG` |
| 727 | 탭 캡처 | `Cap`, `updateCapUI`, `ensureCapture`, `showFreeze/hideFreeze` |
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

**서버 접근** — 모든 요청에 `apikey`+`Authorization: Bearer <anon>`; 운영자는 `x-operator-key`, 클라이언트는 `x-review-token`. RLS가 헤더를 `request.headers`로 읽어 판정.

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
5. 고객용 사용 설명서(A4 2쪽, 별도 디자인 캔버스로 제작됨)를 링크 기반 흐름으로 갱신.
