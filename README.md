# ClaudeBuddy

🐾 **Keeping an eye on your Claude usage, so you don't have to**

**🤖 클로드로 만든 클로드 사용량 감시하는 클로드버디!** 

**100% 오픈소스 Chrome 확장 프로그램**으로 Claude.ai 사용량을 실시간 추적하고 분석합니다. 토큰 사용량, 비용 추정, 사용 패턴 분석을 통해 Claude 사용을 효율적으로 관리하세요.

💡 **코드가 마음에 들지 않나요?** Fork해서 자유롭게 수정하세요! MIT 라이선스로 상업적 사용도 가능합니다.

## ✨ 주요 기능

### 📊 실시간 사용량 추적
- **5시간/주간 사용량** 모니터링 (Anthropic 공식 제한 기준)
- **백그라운드 토큰 추적** - API 응답에서 토큰 사용량 자동 수집
- **모델별 공식 제한** 구분 (Claude Opus, Sonnet 주간 제한)
- **익스텐션 배지**에 사용량 퍼센트 표시

### 💰 비용 분석 (개발 예정)
- **비용 계산 엔진** 준비 완료 (Anthropic 공식 요금 기준)
- **모델별 요금 정보** 내장 (Opus, Sonnet, Haiku)
- **캐시 읽기/쓰기 비용** 계산 지원
- *현재 UI에는 미적용 - 개발자가 추가 구현 필요*

### 🔔 스마트 알림 시스템
- **사용자 정의 임계값** 설정 (기본: 80%, 95%)
- **한도 도달 예측** - AI 기반 사용 패턴 분석
- **시간대별/요일별** 패턴 고려한 예측
- **알림 방식 선택** - 데스크톱 알림 또는 배지만

### 📈 고급 분석
- **사용 패턴 인사이트** - 시간대별 사용 경향 분석
- **가속도 기반 예측** - 사용량 증가/감소 추세 반영
- **예측 알고리즘** - 패턴 기반 한도 도달 시점 추정
- **히스토리 추적** - 최대 20개 데이터포인트 기반 분석

### 🎨 사용자 인터페이스
- **팝업 UI** - 빠른 사용량 확인
- **사이드패널** - 상세 분석 및 설정
- **다크/라이트 테마** - 시스템 설정 자동 적용
- **표시 방식 선택** - 배터리형/반원형 게이지 (설정에서 변경 가능)
- **진행률 바** - 직관적인 사용량 시각화

### ⚙️ 설정 옵션
- **배지 표시 기준** 변경 (5시간 vs 주간)
- **새로고침 주기** 설정 (1분~30분)
- **알림 임계값** 커스터마이징
- **표시 방식** 변경 (배터리 vs 게이지)
- **사이드패널** 활성화/비활성화

## 🚀 설치 방법

### 📦 바로 사용하기
1. **[Releases 페이지](https://github.com/choiyounwook/ClaudeBuddy/releases)에서 최신 빌드 다운로드**
   - `ClaudeBuddy-v1.x.x.zip` 다운로드
   - 압축 해제 후 Chrome에서 로드
2. **직접 빌드하기** (아래 개발자 섹션 참고)

### 🔧 개발자/커스터마이징 원하는 분

```bash
# 1. 코드 복사해가기
git clone https://github.com/choiyounwook/ClaudeBuddy.git
cd ClaudeBuddy

# 2. 의존성 설치
npm install

# 3. 빌드
npm run build

# 4. Chrome에 로드
# Chrome 설정 → 확장 프로그램 → 개발자 모드 ON → "압축해제된 확장 프로그램" → dist 폴더 선택
```

🎨 **자유롭게 수정하세요!** 
- UI가 마음에 안 들면 → `src/popup/`, `src/sidepanel/` 수정
- 알림 로직 바꾸고 싶으면 → `src/background/` 수정  
- 새로운 기능 추가하고 싶으면 → 언제든 환영!

**License**: MIT - 상업적 사용, 재배포, 수정 모두 자유!

## 📱 사용법

### 기본 사용
1. **Claude.ai 접속** - 확장 프로그램이 자동으로 사용량 추적 시작
2. **배지 확인** - 익스텐션 아이콘의 숫자로 현재 사용량 확인
3. **팝업 열기** - 아이콘 클릭으로 상세 정보 확인
4. **사이드패널** - 고급 분석 및 설정 접근 (활성화 시)

### 고급 기능
- **로컬 서버 연동** - `~/.claude/` 디렉토리의 jsonl 파일에서 추가 통계
- **패턴 분석** - 사용 이력 기반 한도 도달 시점 예측
- **비용 최적화** - 모델별 비용 비교를 통한 효율적 사용

## 🔧 개발 정보

### 기술 스택
- **Frontend**: React, TypeScript, Tailwind CSS
- **Build**: Vite, CRXJS
- **Chrome APIs**: Storage, Cookies, Alarms, Notifications
- **Content Script**: Fetch API 인터셉션

### 프로젝트 구조
```
src/
├── background/         # 서비스 워커 (백그라운드 처리)
├── content/           # Claude.ai 페이지 injection
├── popup/             # 팝업 UI
├── sidepanel/         # 사이드패널 UI  
├── shared/            # 공통 타입, 스토리지, 가격 정보
server/                # 로컬 통계 서버 (선택사항)
```

### 개발 명령어
```bash
npm run dev      # 개발 모드 (watch)
npm run build    # 프로덕션 빌드
npm run release  # 릴리즈 준비 (빌드 + 안내)
```

### 🚀 릴리즈 만들기
```bash
# 1. 버전 업데이트
# package.json과 manifest.json의 version 수정

# 2. 릴리즈 빌드
npm run release

# 3. Git 태그 생성 & 푸시
git add .
git commit -m "Release v1.1.0"
git tag v1.1.0
git push origin v1.1.0

# 4. GitHub Actions가 자동으로 릴리즈 생성! 🎉
```

## 🛡️ 개인정보 보호 (오픈소스의 힘!)

- **로컬 저장소만 사용** - 모든 데이터는 브라우저 로컬에 저장
- **외부 전송 없음** - Claude.ai와 Anthropic API 외 외부 서버 통신 없음
- **최소 권한** - 필요한 권한만 요청
- **100% 투명한 코드** - 모든 소스가 공개되어 있어서 뭘 하는지 직접 확인 가능

🔍 **의심스럽다면 코드를 직접 보세요!** 
- `src/content/claude-interceptor.ts` - Claude.ai에서 뭘 수집하는지
- `src/background/service-worker.ts` - 백그라운드에서 뭘 하는지
- 숨길 건 하나도 없습니다!

## 🤝 기여하기 (대환영! 🎉)

**뭐든 가져다 쓰세요!** 버그 리포트도 좋고, 아예 새로 만드는 것도 좋습니다.

### 🚀 바로 시작하기
```bash
# 1. Fork & Clone 
git clone https://github.com/YOUR_USERNAME/ClaudeBuddy.git

# 2. 브랜치 만들기
git checkout -b my-awesome-feature

# 3. 코딩 & 커밋
git commit -m "Add my awesome feature"

# 4. Push & PR
git push origin my-awesome-feature
```

💡 **자동 릴리즈**: 버전 태그를 푸시하면 GitHub Actions가 자동으로 빌드하고 zip 파일을 만들어 릴리즈 생성!

### 💡 이런 기여도 환영해요
- 🐛 버그 수정
- ✨ 새로운 기능 
- 🎨 UI/UX 개선
- 📚 문서 개선
- 🌍 다국어 지원
- 🔧 완전히 다른 방향으로 Fork

**License가 MIT라서 뭘 해도 OK!** 상업적 사용도 자유입니다.

## 📄 라이선스 - 완전 자유!

**MIT License** 🎉
- ✅ 상업적 사용 OK
- ✅ 수정/배포 OK  
- ✅ 개인/기업 프로젝트에 포함 OK
- ✅ 코드 일부분만 가져가기 OK
- ✅ 완전히 다르게 만들기 OK

**그냥 가져다 쓰세요!** 출처 표시만 해주시면 됩니다.

## ⚠️ 면책조항

이 도구는 Anthropic과 공식적으로 연관되어 있지 않습니다. 비공식 도구로 사용량 추정치만 제공하므로, 정확한 청구 정보는 Anthropic 공식 대시보드를 참조해주세요.

---

**🎯 마지막으로:** 이 프로젝트가 유용하다면 ⭐ Star 눌러주세요! 아니면 Fork해서 더 나은 버전을 만들어주세요! 🚀
