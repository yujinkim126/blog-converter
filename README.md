# Blog Converter — ARTIENCE

구글 독스 → Ghost 블로그 HTML 변환 및 발행 도구

## 기능

- 구글 독스 복사 → 붙여넣기로 자동 파싱
- 대표님 블로그 스타일 HTML 자동 변환
- 블록 단위 편집 (타입 변경, 순서 이동, 추가/삭제)
- 이미지 → Ghost 자동 업로드 → URL 자동 치환
- Ghost Admin API로 초안 저장 / 바로 발행
- API 키는 서버 환경변수에만 저장 (브라우저 노출 없음)

## 셋업

### 1. 프로젝트 클론 & 설치

```bash
git clone <your-repo-url>
cd blog-converter
npm install
```

### 2. Ghost Admin API 키 생성

1. Ghost Admin → **Settings** → **Integrations**
2. **Add custom integration** 클릭
3. 이름: `Blog Converter` (아무거나)
4. **Admin API Key** 복사 (형식: `id:secret`)

### 3. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일 편집:

```
GHOST_URL=https://your-ghost-blog.ghost.io
GHOST_ADMIN_API_KEY=64자리id:32자리secret
```

### 4. 로컬 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

## Vercel 배포

### 1. GitHub에 푸시

```bash
git init
git add .
git commit -m "Blog Converter 초기 셋업"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Vercel 연결

1. [vercel.com](https://vercel.com) 접속 → **New Project**
2. GitHub 리포 선택
3. **Environment Variables** 추가:
   - `GHOST_URL` = `https://your-ghost-blog.ghost.io`
   - `GHOST_ADMIN_API_KEY` = `id:secret`
4. **Deploy** 클릭

### 3. 완료!

배포된 URL을 전사에 공유하면 끝.

## 사용법

1. 구글 독스에서 글 작성
2. `Ctrl+A` → `Ctrl+C`로 전체 복사
3. Blog Converter 열고 붙여넣기 영역 클릭 → `Ctrl+V`
4. 자동 변환된 블록 확인 & 편집
5. 제목, 태그, Meta Description 입력
6. **Ghost 초안 저장** 또는 **바로 발행** 클릭

## 프로젝트 구조

```
blog-converter/
├── app/
│   ├── api/
│   │   ├── publish/route.ts    # Ghost 발행 API
│   │   └── upload/route.ts     # Ghost 이미지 업로드 API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── BlogConverter.tsx       # 메인 UI 컴포넌트
├── lib/
│   ├── ghost.ts                # Ghost API 헬퍼 (JWT, 업로드, 발행)
│   └── template.ts             # 블로그 스타일 HTML 템플릿
├── .env.local.example
├── next.config.js
├── package.json
└── README.md
```
