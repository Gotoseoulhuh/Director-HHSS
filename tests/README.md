# tests (선택)

`review.test.cjs`(상위 폴더, npm 패키지 없음)가 기본 회귀 검사입니다. 이 폴더의 검사는 Playwright가 필요합니다.

```
npm i playwright
CHROME=/path/to/chrome node tests/t_dboard1.js   # FPS 판별, 1프레임 이동, 핀 드래그/우클릭/되돌리기, 새로고침 후 id 유지
CHROME=/path/to/chrome node tests/t_sync.js      # 운영자/클라이언트 서버 동기화 (mock_supabase.js가 PostgREST를 흉내 냄)
```

`t_sync.js`는 `index.html`의 `SERVER_DEFAULT`가 `{url:'https://mock.supabase.co',anonKey:'anon.key.test'}` 인 빌드를 기대합니다. 배포용 값이 들어간 파일로 돌리려면 복사본을 만들어 그 두 값만 바꾸세요.
`media/`의 영상은 ffmpeg testsrc로 만든 4~6초짜리 테스트 파일입니다.
