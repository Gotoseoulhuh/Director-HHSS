# 서버 연결과 배포 — SETUP

클라이언트가 남긴 주석을 서버에 자동 저장하고 운영자가 바로 보려면 **Supabase(저장소)** 와 **GitHub Pages(앱 주소)** 두 가지를 한 번만 설정합니다. 둘 다 무료 플랜으로 충분합니다. 소요 시간 15분.

> 비밀 키 원칙: HTML·GitHub 저장소에는 **공개용 값(Project URL, anon 키)** 만 들어갑니다. **운영자 키**는 Supabase에 해시로만 저장되고, 운영자 본인 브라우저의 설정에만 입력합니다. **service_role 키는 어디에도 쓰지 않습니다.**

## 1. Supabase 준비 (5분)

1. https://supabase.com 에서 프로젝트를 하나 만듭니다 (Region은 Northeast Asia(Seoul) 권장).
2. 왼쪽 메뉴 **SQL Editor** → New query → `supabase/schema.sql` 파일 내용을 전부 붙여 넣고 **Run**.
   테이블 3개(projects / annotations / comments), 접근 규칙(RLS), 함수 2개가 만들어집니다. 다시 실행해도 안전합니다.
3. 같은 SQL Editor에서 **운영자 키**를 정해 아래를 실행합니다. `여기에-운영자-키` 자리에 본인만 아는 긴 문자열(20자 이상, 영문·숫자)을 넣으세요.
   ```sql
   insert into public.app_config(key, value)
     values ('operator_key_hash', extensions.crypt('여기에-운영자-키', extensions.gen_salt('bf')))
     on conflict (key) do update set value = excluded.value;
   ```
   이 키는 해시로만 저장되어 다시 볼 수 없습니다. 잊어버리면 위 SQL을 새 키로 다시 실행하면 됩니다 (기존 데이터는 그대로).
4. **Project Settings → API** 에서 두 값을 복사해 둡니다.
   - Project URL (예: `https://abcdefgh.supabase.co`)
   - `anon` `public` 키 (긴 `eyJ...` 문자열) — 공개용이라 HTML에 넣어도 됩니다.

## 2. 앱에 공개 값 넣기 (1분)

`index.html` 을 메모장이나 VS Code로 열어 `SERVER_DEFAULT` 를 찾아(Ctrl+F) 두 값을 채웁니다.

```js
const SERVER_DEFAULT={url:'https://abcdefgh.supabase.co',anonKey:'eyJ...'};
```

이 한 줄 덕분에 클라이언트가 링크로 열었을 때 어디에 저장할지 알게 됩니다. 운영자 키는 **넣지 마세요.**

## 3. GitHub Pages에 올리기 (5분)

유튜브 영상 검수와 클라이언트 링크는 `https://` 주소에서만 동작합니다 (파일로 직접 열면 유튜브가 재생을 거부함).

1. 저장소: https://github.com/Gotoseoulhuh/Director-HHSS (이미 올라가 있음). 고칠 때는 `index.html`을 같은 이름으로 다시 올리면 됩니다.
2. 배포는 `.github/workflows/pages.yml` 이 main 푸시마다 자동으로 합니다 (Actions 탭에서 진행 확인).
3. 공개 주소: **https://gotoseoulhuh.github.io/Director-HHSS/** — 운영자 설정의 '이 앱의 공개 주소'에 이 값을 넣습니다.
4. 이미 만든 클라이언트 링크는 파일을 다시 올려도 그대로 유효합니다.

저장소가 Public이어도 괜찮습니다. 올라가는 것은 앱 코드와 공개 키뿐이고, 영상·주석은 Supabase와 사용자 PC에만 있습니다.

## 4. 운영자 브라우저 설정 (2분)

1. Pages 주소(또는 `검수기 실행.cmd`)로 앱을 엽니다.
2. **서버 ▾ → 서버 설정** 에 네 칸을 채웁니다.
   - Supabase 프로젝트 URL, anon 키 (2번과 같은 값)
   - 운영자 키 (1-3에서 정한 값 — 이 브라우저에만 저장됨)
   - 이 앱의 공개 주소: `https://gotoseoulhuh.github.io/Director-HHSS/` — 클라이언트 링크를 만들 때 씁니다
3. **연결 테스트** → "연결 확인 ✓ 운영자 권한 OK" 가 나오면 **저장**.
   - "운영자 키가 맞지 않아요" → 1-3의 SQL을 다시 확인
   - 401 → anon 키 또는 URL이 다른 프로젝트
   - 404 (rpc/is_operator 없음) → schema.sql이 실행되지 않음

학교 PC 등 다른 브라우저에서도 운영자로 쓰려면 그 브라우저에서 4번을 한 번 더 합니다.

## 5. 일상 흐름

```
운영자: 영상 열기 → 서버 ▾ → 클라이언트 검수 만들기 → 링크 복사(유튜브/파일) 또는 클라이언트 HTML 내려받기(파일 동봉용)
클라이언트: 링크 열기(또는 HTML 더블클릭) → 이름 입력 → (파일 프로젝트면 받은 영상 파일 열기) → 보다가 클릭·메모 → 끝 (자동 저장)
운영자: 서버 ▾ → 서버 프로젝트 열기 → 해당 프로젝트 열기 → 클라이언트 메모가 작성자 이름과 함께 보임 (8초마다 갱신)
```

- 클라이언트 링크 형식: `https://…/index.html#r=<프로젝트id>.<토큰>` — 토큰은 그 프로젝트 하나에만 쓸 수 있는 접근 키입니다. `#` 뒤는 서버로 전송되지 않습니다.
- 클라이언트 HTML(동봉용)에는 프로젝트 정보·토큰·공개 키가 들어 있고 운영자 키는 없습니다. 영상 파일과 함께 카톡·메일로 보내면 웹 주소 없이도 열립니다(유튜브 프로젝트는 제외).
- 프로젝트를 더 받지 않으려면 서버 프로젝트 목록에서 **보관**. (토큰을 무효화하려면 Supabase Table Editor에서 그 행의 `review_token` 을 바꾸거나 행을 삭제)

## 6. 데이터와 한계

- 주석은 행 단위로 저장됩니다(`annotations`). 삭제는 `deleted_at` 을 채우는 방식이라 복구가 가능하고, 되돌리기도 서버에 반영됩니다. 충돌은 수정 번호(`rev`)가 큰 쪽이 이깁니다.
- 썸네일은 1280px JPEG를 **DB의 text 컬럼에 base64로** 저장합니다(행당 최대 약 1.2MB로 제한). 무료 플랜 DB 500MB 기준 2~3천 장 수준입니다. 그 이상이면 Supabase Storage로 옮기는 작업이 필요합니다(HANDOFF 참고).
- 운영자 화면 갱신은 8초 폴링(클라이언트 15초)이며 실시간 푸시는 아닙니다.
- 운영자 키는 "공유 비밀번호" 모델입니다. 여러 운영자가 각자 계정으로 써야 한다면 Supabase Auth로 바꾸는 작업이 필요합니다.
- 이 연결 코드는 Supabase와 같은 규칙을 구현한 모의 서버로 검증했습니다. **실제 Supabase에 처음 연결할 때는 4번의 연결 테스트와 메모 1개 왕복을 꼭 확인하세요.** 브라우저가 보내는 `x-review-token`/`x-operator-key` 헤더는 Supabase의 표준 기능(`request.headers`)으로 읽습니다.
