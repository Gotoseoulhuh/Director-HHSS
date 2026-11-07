# 서버 연결과 배포 — SETUP

클라이언트가 보낸 수정 요청을 관리자 화면에서 받으려면 **Supabase(저장소·로그인)** 를 한 번 설정해야 합니다. 무료 플랜으로 충분하고, 15분 정도 걸립니다. 앱 주소(GitHub Pages)는 이미 배포되어 있습니다.

> 비밀 원칙: HTML·GitHub 저장소에는 **공개용 값(Project URL, anon 키)** 만 들어갑니다. 관리자 비밀번호는 Supabase에만 있고, 클라이언트 비밀번호는 해시(암호화된 값)로만 저장됩니다. **service_role 키는 어디에도 쓰지 않습니다.**

## 1. Supabase 준비 (10분)

1. https://supabase.com 에서 **이 앱 전용 프로젝트**를 하나 만듭니다 (Region: Northeast Asia (Seoul) 권장).
2. 왼쪽 **SQL Editor** → New query → `supabase/schema.sql` 내용을 전부 붙여 넣고 **Run**. (다시 실행해도 안전)
3. **관리자 계정 만들기**
   1. 왼쪽 **Authentication → Users → Add user → Create new user**
   2. Email: `원하는아이디@hhss.studio` (예: `hhss@hhss.studio`) — 로그인 화면에서는 **@ 앞부분만** 아이디로 넣으면 됩니다. 평소 쓰는 이메일을 넣어도 되고, 그럴 땐 로그인할 때 이메일 전체를 넣습니다.
   3. Password: 본인만 아는 비밀번호 (이 비밀번호는 Supabase에만 저장되고 앱·저장소 어디에도 들어가지 않습니다)
   4. **Auto Confirm User** 체크 → Create user
   5. SQL Editor에서 아래를 실행해 이 계정을 관리자로 등록합니다 (이메일만 바꿔서).
      ```sql
      insert into public.operators(user_id)
        select id from auth.users where email = 'hhss@hhss.studio'
        on conflict do nothing;
      ```
4. **아무나 가입하지 못하게**: Authentication → Sign In / Providers(또는 Settings) 에서 **Allow new users to sign up** 을 끕니다. (꺼 두지 않아도 관리자로 등록되지 않은 계정은 아무 권한이 없지만, 꺼 두는 게 깔끔합니다)
5. **Project Settings → API** 에서 두 값을 복사합니다.
   - Project URL (예: `https://abcdefgh.supabase.co`)
   - `anon` `public` 키 (긴 `eyJ...` 문자열) — 공개용이라 HTML에 넣어도 됩니다.

## 2. 앱에 공개 값 넣기

두 값을 Claude에게 주면 `index.html`의 `SERVER_DEFAULT`에 넣어 푸시합니다. 직접 하려면 `index.html`에서 `SERVER_DEFAULT`를 찾아(Ctrl+F) 채웁니다.

```js
const SERVER_DEFAULT={url:'https://abcdefgh.supabase.co',anonKey:'eyJ...'};
```

이 값이 들어간 뒤로는 앱을 열면 **관리자 로그인 화면**이 먼저 나옵니다. 어느 PC에서든 1-3의 아이디·비밀번호로 들어갈 수 있습니다.

## 3. 앱 주소 (GitHub Pages)

- 저장소: https://github.com/Gotoseoulhuh/Director-HHSS — `main`에 푸시하면 `.github/workflows/pages.yml`이 1~2분 안에 자동 배포합니다.
- 주소: **https://gotoseoulhuh.github.io/Director-HHSS/** (커스텀 도메인 `review.hhss.studio`를 연결하면 그 주소로 바뀌고, 옛 주소는 자동으로 넘어갑니다)
- 커스텀 도메인 연결: Cloudflare DNS에 `CNAME  review → gotoseoulhuh.github.io` (프록시 끔=회색 구름) → GitHub 저장소 Settings → Pages → Custom domain에 `review.hhss.studio` → Save → Enforce HTTPS.
- 관리자 화면 **서버 ▾ → 서버 설정 → 이 앱의 공개 주소** 에 실제 주소를 넣어 두면 클라이언트 링크가 그 주소로 만들어집니다 (비워 두면 지금 열린 주소를 씀).

## 4. 하루 흐름

```
관리자: 로그인 → 영상 열기(유튜브 링크 또는 파일) → 서버 ▾ → 클라이언트 검수 만들기
        → 프로젝트 이름 · 클라이언트 아이디 · 비밀번호(자동 생성 가능) → 만들기 → '안내 문구 복사' → 카톡/메일로 전달
        (영상 파일 프로젝트면 그 영상 파일도 함께 보냄)
클라이언트: 링크 열기 → 아이디·비밀번호 로그인 → 영상 보며 클릭·메모 → '빠른 수정 요청' 버튼
관리자: 서버 ▾ → 서버 프로젝트 열기 → 해당 프로젝트 → 클라이언트 요청이 작성자 이름과 함께 보임 (8초마다 갱신)
```

- 클라이언트 링크: `https://…/#p=<프로젝트id>` — 링크만으로는 아무것도 볼 수 없고, 아이디·비밀번호가 맞아야 그 프로젝트 **하나만** 열립니다.
- 클라이언트 메모는 **'빠른 수정 요청'을 누를 때만** 서버로 갑니다. 누르기 전에는 클라이언트 PC에만 저장됩니다(창을 닫아도 남음). 다시 누르면 새로 쓰거나 고친 것만 보내집니다.
- 비밀번호를 잊었으면 서버 프로젝트 목록 → **비번 재설정**. 바꾸면 기존 로그인은 끊기고, 새 비밀번호가 담긴 안내 문구가 복사됩니다.
- 검수를 마감하려면 목록에서 **보관** — 클라이언트가 더 이상 로그인할 수 없습니다(데이터는 남음, '복원' 가능).
- 동봉용 HTML(파일 프로젝트용)도 열면 같은 로그인 화면이 나옵니다. 그 파일에는 토큰·비밀번호가 들어 있지 않습니다.

## 5. 데이터와 한계

- 주석은 행 단위로 저장(`annotations`), 삭제는 `deleted_at`을 채우는 방식이라 복구 가능. 충돌은 수정 번호(`rev`)가 큰 쪽이 이깁니다.
- 영상 파일 프로젝트의 썸네일은 1280px JPEG를 DB에 base64로 저장(행당 최대 약 1.2MB). 유튜브 프로젝트는 썸네일 없이 시간·위치만 저장합니다.
- 관리자 화면 갱신은 8초 폴링이며 실시간 푸시는 아닙니다.
- 클라이언트 로그인은 틀릴 때마다 1초씩 늦게 응답해 무작위 대입을 늦춥니다. 비밀번호는 자동 생성(8자)을 권장합니다.
- Supabase 무료 프로젝트는 약 1주 동안 요청이 없으면 일시 정지될 수 있습니다. 정지되면 Supabase 대시보드에서 다시 켜면 되고 데이터는 남습니다.
- 이 연결 코드는 Supabase와 같은 규칙을 구현한 모의 서버로 검증했습니다. **실제 Supabase에 처음 연결한 뒤에는 관리자 로그인 → 클라이언트 검수 만들기 → 다른 브라우저(시크릿 창)에서 클라이언트 로그인 → 빠른 수정 요청 → 관리자 화면에 들어오는지** 한 번 확인해 주세요.
