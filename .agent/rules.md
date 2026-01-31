# 프로젝트 규칙 (Project Rules)

## 언어 및 커뮤니케이션

### 응답 언어
- **모든 응답은 한국어로 작성**합니다.
- 기술 용어는 필요시 영어를 병기하되, 설명은 한국어로 제공합니다.
  - 예: "열회수 효율(Heat Recovery Efficiency)"

### 코드 주석
- **모든 코드 주석은 한국어로 작성**합니다.
- 함수/클래스 설명, 매개변수 설명, 복잡한 로직 설명 모두 한국어로 작성합니다.
- JSDoc/TSDoc 주석도 한국어로 작성합니다.

### 변수명 및 함수명
- 변수명, 함수명, 클래스명은 **영어로 작성**합니다 (코드 표준 준수).
- 단, 의미가 명확하도록 camelCase 또는 PascalCase를 사용합니다.

### 문서화
- README, 구현 계획, 작업 내역 등 모든 문서는 **한국어로 작성**합니다.
- 기술 문서의 경우 영어 원문이 중요한 경우 병기할 수 있습니다.

## 코드 스타일

### TypeScript
- 엄격한 타입 체크를 유지합니다.
- `any` 사용은 최소화하되, 복잡한 라이브러리 타입 이슈 해결 시 선택적으로 사용 가능합니다.

### React
- 함수형 컴포넌트와 Hooks를 사용합니다.
- 컴포넌트 주석은 한국어로 작성합니다.

### 에너지 계산 로직
- **최신 표준인 DIN/TS 18599:2025-10 규정을 준수**합니다. 이전 버전(2011, 2018 등)의 수식이나 계수가 아닌 최신 규정을 참조해야 합니다. (이 규정은 "전환 에너지 효율" 대신 "1차 에너지 요구량" 등 최신 용어와 방법론을 포함합니다.)
- 계산 로직에는 상세한 한국어 주석을 포함하여 이해를 돕습니다.

## 예시

```typescript
/**
 * 시간별 난방 부하를 계산합니다.
 * DIN/TS 18599:2025-10 규정을 준수하여 구현합니다.
 * 
 * @param zone - 계산 대상 존 (Zone)
 * @param weather - 시간별 기상 데이터
 * @returns 시간별 난방 부하 (Wh)
 */
function calculateHourlyHeating(zone: ZoneInput, weather: HourlyClimate[]): number[] {
    // 열관류율 계산 (Transmission Coefficient)
    const H_tr = calculateTransmission(zone.surfaces);
    
    // 환기 열손실 계산 (Ventilation Heat Loss)
    const H_ve = calculateVentilation(zone.volume);
    
    return results;
}
```
