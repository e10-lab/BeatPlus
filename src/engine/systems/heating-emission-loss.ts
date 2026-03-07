/**
 * DIN/TS 18599-5:2025-10 6.1~6.2절 — 방열 손실(Q_h,ce) 계산
 *
 * 식(34): Q_h,ce = Q_h,b × (Δθ_ce / (θ_i,h − θ_e))
 *
 * Δθ_ce = Δθ_str + Δθ_ctr + Δθ_emb + Δθ_rad + Δθ_im + Δθ_hydr + Δθ_roomaut
 *
 * 천장고 4m 기준으로 분류:
 * ≤ 4m: 표 14~18 (고정 편차값 참조)
 * > 4m: 표 19 + 식 41 (천장고 함수로 산출)
 */

// ─── 타입 정의 ───

/** 공간 분류 */
export type SpaceCategory = 'standard' | 'hall';

/** 방열기 유형 — 일반 공간 (표 14~18) + 대공간 (표 19) */
export type EmitterType =
    // 표 14: 노출형 방열기
    | 'radiator' | 'convector' | 'fcu'
    // 표 15: 매립형 면난방
    | 'floor_heating' | 'wall_heating' | 'ceiling_heating'
    // 표 16: 콘크리트코어 활성화
    | 'tabs'
    // 표 17: 급기 난방
    | 'supply_air'
    // 표 18: 독립형 전기 난방기
    | 'electric_heater'
    // 표 19: 대공간 난방
    | 'hall_air' | 'infrared_radiant' | 'ceiling_radiant_panel' | 'hall_floor_heating'
    // 6.2.2.4.9절: 기존 건물 대공간 라디에이터
    | 'hall_radiator';

/** 노출형 방열기 배관 방식 (표 14) */
export type PipingType = 'two_pipe' | 'one_pipe_improved' | 'one_pipe' | 'distributed';

/** 방열기 설치 위치 (표 14 Δθ_str,2) */
export type RadiatorPosition = 'interior_wall' | 'exterior_wall_opaque' | 'exterior_wall_transparent';

/** 대공간 공기난방 세부 유형 (표 19 θ'_str) */
export type HallAirSubType = 'wall_horizontal' | 'low_temp_horizontal' | 'ceiling_downward' | 'low_temp_ceiling' | 'ceiling_fan_2pos' | 'ceiling_fan_pi';

/** 적외선 복사난방 세부 유형 */
export type InfraredSubType = 'standard' | 'improved';

/** 천장 복사패널 세부 유형 (표 19)
 *  general: 단순형 (상부 단열 없음)
 *  standard_no_gap: 표준형 (외벽 이격거리 미준수)
 *  standard_gap: 표준형 (외벽 이격거리 준수)
 *  improved_no_gap: 개선형 (외벽 이격거리 미준수)
 *  improved_gap: 개선형 (외벽 이격거리 준수)
 */
export type CeilingPanelSubType = 'general' | 'standard' | 'improved'
    | 'standard_no_gap' | 'standard_gap' | 'improved_no_gap' | 'improved_gap';

/** 제어 방식 — 표 11 */
export type ControlType = 'manual' | 'central' | 'electromechanical' | 'p_control' | 'pi_control' | 'pi_optimized';

/** 수력 균형 상태 — 표 10 (배관 방식별 세분화) */
// 2관식 (Zweirohrnetz)
export type TwoPipeHydraulic = 'none' | 'static' | 'static_group_static' | 'static_group_dynamic' | 'dynamic';
// 1관식 (Einrohrnetz)
export type OnePipeHydraulic = 'none' | 'static_loop' | 'dynamic_loop' | 'dynamic_return_temp' | 'dynamic_delta_temp';
// 통합 타입
export type HydraulicBalancing = TwoPipeHydraulic | OnePipeHydraulic;

/** 바닥난방 매립 방식 */
export type EmbeddingType = 'wet' | 'dry' | 'low_coverage';

/** 바닥난방 하부 단열 수준 */
export type FloorInsulation = 'none' | 'standard' | 'enhanced';

/** 대공간 바닥난방 매설 깊이 (표 19) */
export type HallFloorDepth = 'deep' | 'shallow';

/** 대공간 바닥난방 하부 단열 수준 (표 19) */
export type HallFloorInsulation = 'none' | 'min1' | 'min2' | 'full';

/** 실내 자동화 수준 */
export type RoomAutomation = 'none' | 'time_control' | 'start_stop_optimized' | 'full_automation';

/** 방열 손실 계산 입력 */
export interface EmissionLossInput {
    Q_h_b: number;               // 월간 순수 난방 요구량 (kWh)
    theta_i: number;             // 실내 설정 온도 (°C)
    theta_e: number;             // 월평균 외기 온도 (°C)

    // 공간 분류
    spaceCategory?: SpaceCategory;

    // 방열기 사양
    emitterType: EmitterType;

    // 노출형 방열기 세부 (표 14)
    pipingType?: PipingType;
    radiatorPosition?: RadiatorPosition;
    sunProtection?: boolean;     // 투명 창호 설치 시 일사 차단 장치 유무
    temperatureRegime?: string;  // 배관 설계 온도 (distribution에서 전달)

    // 매립형 면난방 세부 (표 15)
    embeddingType?: EmbeddingType;
    floorInsulation?: FloorInsulation;

    // 대공간 세부 (표 19)
    hallAirSubType?: HallAirSubType;
    infraredSubType?: InfraredSubType;
    ceilingPanelSubType?: CeilingPanelSubType;
    roomHeight?: number;          // 천장고 (m, 기본값 3.0)

    // 제어 사양
    controlType?: ControlType;
    isCertified?: boolean;        // 제어기 인증 여부 (EN 15500-1 등)
    roomAutomation?: RoomAutomation;

    // 배관 균형
    hydraulicBalancing?: HydraulicBalancing;
    emitterCount?: number;       // 배관망 방열기 개수 n (표 10 n≤10/n>10 분기용)

    // 환기 연동
    hasVentilationLink?: boolean;

    // 간헐 운전
    isIntermittent?: boolean;

    // TABS 제어 방식
    tabsControlType?: 'constant_temp' | 'central_or_electric';

    // 급기 난방 제어 (표 17, 6.2.2.4.6절)
    supplyAirControlVariable?: 'room_temp' | 'room_temp_cascade' | 'exhaust_temp';
    supplyAirControlQuality?: 'low' | 'high';

    // 독립형 전기 난방 (표 18, 6.2.2.4.7절)
    electricHeaterType?: 'direct' | 'storage';       // 직접 난방 vs 축열식
    electricHeaterPosition?: 'exterior' | 'interior';  // 외벽 vs 내벽 설치
    electricHeaterControl?: 'none' | 'p' | 'pi' | 'pid'; // 제어기 종류

    // 대공간 바닥난방 세부 (표 19, 6.2.2.4.8절)
    hallFloorDepth?: HallFloorDepth;       // 매설 깊이
    hallFloorInsulation?: HallFloorInsulation; // 하부 단열 수준

    // 식 42 입력 변수 (대공간 복사난방)
    hallHeatingLoad?: number;   // 단위면적당 최대 난방 부하 p_h (W/m²)
    radiationFactor?: number;   // 복사 계수 RF
    temperatureGradient?: number; // 온도 구배 theta'_str (K/m)
    specificHeatingLoad?: number; // 단위면적당 난방부하 p_h (W/m², hallHeatingLoad의 Alias 역할)
}

/** 방열 손실 계산 결과 */
export interface EmissionLossResult {
    Q_h_ce: number;              // 방열 손실 (kWh)
    delta_theta_ce: number;      // 총 온도 편차 (K)

    // 상세 구성요소 (검증용)
    delta_theta_str: number;     // 공기 층화 편차 (K)
    delta_theta_ctr: number;     // 제어 편차 (K)
    delta_theta_emb: number;     // 매립 손실 (K)
    delta_theta_rad: number;     // 복사열 편차 (K)
    delta_theta_im: number;      // 간헐 운전 편차 (K)
    delta_theta_hydr: number;    // 수력 불균형 편차 (K)
    delta_theta_roomaut: number; // 실내 자동화 보정 (K)

    f_hydr: number;              // 수력 평형 계수

    // [신규] 방열 설정 레이블 및 대공간 상세 변수 (UI 표시용)
    labels?: {
        control?: string;
        hydraulic?: string;
        automation?: string;
        stratification?: string;
        position?: string;
        embedding?: string;
    };
    emissionHallDetails?: {
        theta_str_prime?: number; // 온도 구배 (K/m)
        h_R?: number;             // 적용 천장고 (m)
        p_h?: number;             // 단위면적당 난방부하 (W/m²)
        RF?: number;             // 복사 계수
    };
}

// ─── 표 14: Δθ_str,1 — 배관 방식/온도 레벨별 편차 (K) ───

function getStrDelta1(
    emitterType: EmitterType,
    pipingType: PipingType,
    temperatureRegime: string,
    hasVentilationLink: boolean
): number {
    // 환기 설비 연동 시 일괄 0.2 K (DIN/TS 18599-5 표 14 주석)
    if (hasVentilationLink) return 0.2;

    let base = 0.7; // 기본 편차값 초기화

    // 배관 설계 온도 → Δθ_m,N 매핑
    // Δθ_m,N = (Vorlauf + Rücklauf)/2 - θ_i ≈ 60K(90/70), 42.5K(70/55), 30K(55/45), 20K(45/35)
    if (pipingType === 'one_pipe') {
        // 1관식 (미개선)
        switch (temperatureRegime) {
            case '90/70': base = 1.6; break;
            case '70/55': base = 1.2; break;
            default: base = 1.2; // 42.5K 이하 기본값
        }
    } else {
        // 2관식 또는 개선 1관식
        switch (temperatureRegime) {
            case '90/70': base = 1.2; break;
            case '70/55': base = 0.7; break;
            case '55/45': base = 0.5; break;
            case '45/35': base = 0.4; break;
            default: base = 0.7; // 알 수 없는 경우 중간값
        }
    }

    // 팬코일 유닛/유도 장치 혜택 (표 14 주석 b)
    if (emitterType === 'fcu') {
        base = Math.max(0, base - 0.2);
    }

    return base;
}

// ─── 표 14: Δθ_str,2 — 설치 위치별 편차 (K) ───

function getStrDelta2(
    radiatorPosition: RadiatorPosition,
    sunProtection: boolean
): number {
    switch (radiatorPosition) {
        case 'interior_wall': return 1.3;
        case 'exterior_wall_opaque': return 0.3;
        case 'exterior_wall_transparent':
            return sunProtection ? 1.2 : 1.7;
        default: return 0.3;
    }
}

// ─── 표 14/15/19: Δθ_str (공기 층화 편차) — 통합 ───

function getStratificationDelta(input: {
    emitterType: EmitterType;
    spaceCategory: SpaceCategory;
    pipingType: PipingType;
    radiatorPosition: RadiatorPosition;
    sunProtection: boolean;
    temperatureRegime: string;
    hasVentilationLink: boolean;
    roomHeight: number;
    hallAirSubType: HallAirSubType;
    infraredSubType: InfraredSubType;
    ceilingPanelSubType: CeilingPanelSubType;
}): number {
    const {
        emitterType, spaceCategory, pipingType, radiatorPosition, sunProtection,
        temperatureRegime, hasVentilationLink, roomHeight,
        hallAirSubType, infraredSubType, ceilingPanelSubType
    } = input;

    // ══════════════════════════════════════════════════
    // 대공간 (> 4m) 및 예외 천장 복사 패널 (≤ 4m, 6.2.2.4.3절)
    // ══════════════════════════════════════════════════
    if (spaceCategory === 'hall' || emitterType === 'ceiling_radiant_panel') {
        const theta_str_prime = getHallTemperatureGradient(
            emitterType, hallAirSubType, infraredSubType, ceilingPanelSubType
        );
        // 식 41: Δθ_str = 10 · (θ'_str / a) · (0.5 · h_R - b)
        const a = 16;  // K — 난방기 평균 실내외 온도차 기준값
        const b = 1.1; // m — 평균 체류 높이
        // 일반 공간(≤4m)의 천장 복사 패널은 6.2.2.4.3절에 따라 층고 변수를 4.0m로 고정
        const h_R = spaceCategory === 'standard' ? 4.0 : Math.max(roomHeight, 4.1);
        return 10 * (theta_str_prime / a) * (0.5 * h_R - b);
    }

    // ══════════════════════════════════════════════════
    // 일반 공간 (≤ 4m)
    // ══════════════════════════════════════════════════

    // ══════════════════════════════════════════════════
    // 일반 공간 (≤ 4m)
    // ══════════════════════════════════════════════════

    // 바닥/벽/천장 매립형 난방 층화 편차 (DIN/TS 18599-5 Tabelle 15)
    if (['floor_heating', 'wall_heating', 'ceiling_heating'].includes(emitterType)) {
        // 환기 연동 시 모든 매립형 난방 Δθ_str = 0 (표 15 주석)
        if (hasVentilationLink) return 0.0;

        switch (emitterType) {
            case 'floor_heating': return 0.0; // 바닥 난방은 층화 편차 항상 0.0K
            case 'wall_heating': return 0.4;  // 벽면 난방 0.4K
            case 'ceiling_heating': return 0.7; // 천장 난방 0.7K
            default: return 0.0;
        }
    }

    // 표 14: 노출형 방열기 — 식 39: (Δθ_str,1 + Δθ_str,2) / 2
    if (['radiator', 'convector', 'fcu'].includes(emitterType)) {
        const d1 = getStrDelta1(emitterType, pipingType, temperatureRegime, hasVentilationLink);
        const d2 = getStrDelta2(radiatorPosition, sunProtection);
        return (d1 + d2) / 2;
    }

    // 기타 (TABS, 급기난방, 전기난방기 등은 0K 고정 후 호출부에서 통합 처리됨)
    return 0.0;
}

// ─── 표 19: 대공간 θ'_str (온도 구배, K/m) ───

function getHallTemperatureGradient(
    emitterType: EmitterType,
    hallAirSubType: HallAirSubType,
    infraredSubType: InfraredSubType,
    ceilingPanelSubType: CeilingPanelSubType
): number {
    switch (emitterType) {
        case 'hall_air':
            switch (hallAirSubType) {
                case 'wall_horizontal': return 1.0;
                case 'ceiling_downward': return 0.60;
                case 'low_temp_horizontal': return 0.35;
                case 'low_temp_ceiling': return 0.35;
                case 'ceiling_fan_2pos': return 0.35;
                case 'ceiling_fan_pi': return 0.25;
                default: return 0.60;
            }
        case 'infrared_radiant':
            // 표 19: 표준형 0.20 K/m, 개선형 0 K/m
            return infraredSubType === 'improved' ? 0 : 0.20;
        case 'ceiling_radiant_panel':
            switch (ceilingPanelSubType) {
                case 'general': return 1.0;
                // 대공간 전용 외벽 이격거리 옵션
                case 'standard_no_gap': return 0.25;
                case 'standard_gap': return 0;
                case 'improved_no_gap': return 0.20;
                case 'improved_gap': return 0;
                // 일반 공간 호환 (기존 코드)
                case 'standard': return 0.25;
                case 'improved': return 0.20;
                default: return 0.25;
            }
        case 'hall_floor_heating':
            return 0.1;
        case 'hall_radiator':
            // 6.2.2.4.9절: 공기난방 수평 토출 기준 차용
            return 1.0;
        default:
            return 0.5;
    }
}

// ─── 표 11: Δθ_ctr (제어 편차) ───

function getControlDelta(
    controlType: ControlType,
    pipingType: PipingType = 'two_pipe',
    isCertified: boolean = false
): number {
    // 1관식 시스템 예외 (표 11 참고주석): 제어 방식 무관하게 일괄 적용
    if (pipingType === 'one_pipe' || pipingType === 'one_pipe_improved') {
        return isCertified ? 1.8 : 2.0;
    }

    // 2관식 및 분산형 시스템
    switch (controlType) {
        case 'manual':
            return 2.5;
        case 'central':
            return isCertified ? 1.8 : 2.0;
        case 'electromechanical':
            return isCertified ? 1.6 : 1.8;
        case 'p_control':
            // P-제어기 (1988년 이후 기준)
            return isCertified ? 0.7 : 1.2;
        case 'pi_control':
            // 최적화 없는 PI-제어기
            return isCertified ? 0.7 : 1.2;
        case 'pi_optimized':
            // 최적화 기능 포함 PI-제어기
            return isCertified ? 0.5 : 0.9;
        default:
            return isCertified ? 0.7 : 1.2;
    }
}

// ─── 표 15: Δθ_emb (매립 손실) ───

function getEmbeddingDelta(
    emitterType: EmitterType,
    embeddingType: EmbeddingType,
    floorInsulation: FloorInsulation
): number {
    if (!['floor_heating', 'wall_heating', 'ceiling_heating'].includes(emitterType)) {
        return 0;
    }

    // Δθ_emb,1 — 시공 방식별
    let d_emb_1: number;
    switch (embeddingType) {
        case 'wet': d_emb_1 = 0.7; break;
        case 'dry': d_emb_1 = 0.4; break;
        case 'low_coverage': d_emb_1 = 0.2; break;
        default: d_emb_1 = 0.7;
    }

    // 벽면/천장 난방은 기본 0.7
    if (emitterType !== 'floor_heating') {
        d_emb_1 = 0.7;
    }

    // Δθ_emb,2 — 단열 수준별
    let d_emb_2: number;
    switch (floorInsulation) {
        case 'none': d_emb_2 = 1.4; break;
        case 'standard': d_emb_2 = 0.5; break;
        case 'enhanced': d_emb_2 = 0.1; break;
        default: d_emb_2 = 0.5;
    }

    return (d_emb_1 + d_emb_2) / 2;
}

// ─── Δθ_rad (복사열 편차) ───

/** 식 42: 대공간 복사 난방기 복사열 편차 산식 */
function getHallRadiationDelta(
    radiationFactor: number,
    hallHeatingLoad: number,
    roomHeight: number
): number {
    // 식 42: Δθ_rad = 10 × [0.36/(RF+0.2) + 0.354×(70/p_h)^0.12 × (10/h_R)^0.15 − 0.9]
    const RF = Math.max(radiationFactor, 0.01); // 0 나누기 방지
    const p_h = Math.max(hallHeatingLoad, 1);   // 0 나누기 방지
    // 6.2.2.4.3절에 따라 층고 4m 이하라면 4m로 고정, 4m 초과라면 실제 층고 사용 (대공간 로직)
    const h_R = Math.max(roomHeight, 4.0);
    return 10 * (0.36 / (RF + 0.2) * (1 - 0.2) + 0.354 * Math.pow(70 / p_h, 0.12) * Math.pow(10 / h_R, 0.15) - 0.9);
}

function getRadiationDelta(
    roomHeight: number,
    emitterType: EmitterType,
    spaceCategory: SpaceCategory,
    ceilingPanelSubType: CeilingPanelSubType = 'standard',
    radiationFactor: number = 0.5,
    hallHeatingLoad: number = 50
): number {
    // 6.2.2.4.3절: 일반 공간(<= 4m)의 천장 복사 패널은 대공간(6.2.2.4.8절) 로직을 준용함
    if (emitterType === 'ceiling_radiant_panel') {
        const h_R = spaceCategory === 'hall' ? roomHeight : 4.0;
        // 복사 보상 산식(식 42) 적용 여부 판단
        if (['standard_gap', 'standard'].includes(ceilingPanelSubType)) {
            return getHallRadiationDelta(radiationFactor, hallHeatingLoad, h_R);
        }
        return 0;
    }

    // 일반 공간 나머지 방열기는 0K
    if (spaceCategory === 'standard') return 0;

    // 대공간 복사 난방기
    if (emitterType === 'infrared_radiant') {
        return getHallRadiationDelta(radiationFactor, hallHeatingLoad, roomHeight);
    }
    // 공기난방, 바닥난방, 라디에이터: 0K
    return 0;
}

// ─── 표 19: 대공간 매립 편차 (Δθ_emb) ───

function getHallEmbeddingDelta(
    emitterType: EmitterType,
    ceilingPanelSubType: CeilingPanelSubType = 'standard',
    hallFloorDepth: HallFloorDepth = 'shallow',
    hallFloorInsulation: HallFloorInsulation = 'min1'
): number {
    // 천장 복사패널
    if (emitterType === 'ceiling_radiant_panel') {
        switch (ceilingPanelSubType) {
            case 'general': return 0.5;
            case 'standard_no_gap': case 'standard': return 0.3;
            case 'standard_gap': return 0;
            case 'improved_no_gap': case 'improved': return 0.3;
            case 'improved_gap': return 0;
            default: return 0.3;
        }
    }
    // 대공간 바닥난방
    if (emitterType === 'hall_floor_heating') {
        if (hallFloorDepth === 'deep') {
            // 깊은 매설 (> 10cm)
            switch (hallFloorInsulation) {
                case 'none': return 1.9;
                case 'min1': return 1.5;
                case 'min2': return 1.0;
                case 'full': return 0.5;  // 완전 분리 없음
                default: return 1.5;
            }
        } else {
            // 얌은 매설 (≤ 10cm)
            switch (hallFloorInsulation) {
                case 'none': return 1.4;
                case 'min1': return 1.0;
                case 'min2': return 0.5;
                case 'full': return 0;
                default: return 1.0;
            }
        }
    }
    // 공기난방, 적외선 복사, 라디에이터: 0K
    return 0;
}

// ─── Δθ_im (간헐 운전 편차) ───

function getIntermittentDelta(
    isIntermittent: boolean,
    spaceCategory: SpaceCategory,
    emitterType: EmitterType,
    embeddingType: EmbeddingType
): number {
    if (!isIntermittent) return 0;

    // 대공간 시스템: 일괄 0K 고정 (6.2.2.4.8절)
    if (spaceCategory === 'hall' || ['hall_air', 'infrared_radiant', 'hall_floor_heating', 'hall_radiator'].includes(emitterType)) {
        return 0;
    }

    switch (emitterType) {
        case 'radiator':
        case 'convector':
        case 'fcu':
            return -0.3; // 6.2.2.4.2설 라디에이터/컨벡터 및 6.2.2.4.6절 FCU
        case 'floor_heating':
            // 6.2.2.4.4절 표면 난방(바닥)의 간헐 운전 편차
            if (embeddingType === 'low_coverage') return -0.2;
            if (embeddingType === 'dry') return -0.15;
            return 0; // 습식(wet) 등은 열용량이 커서 보상 없음
        case 'wall_heating':
        case 'ceiling_heating':
            return 0; // 표 15에 따라 벽/천장 매립은 습식과 동일(=0K) 취급
        default:
            return 0;
    }
}

// ─── 표 10: Δθ_hydr (수력 불균형 편차) ───

function getHydraulicDelta(
    hydraulicBalancing: HydraulicBalancing,
    pipingType: PipingType = 'two_pipe',
    emitterCount: number = 10
): number {
    const nOver10 = emitterCount > 10;

    // 1관식 (Einrohrnetz)
    if (pipingType === 'one_pipe' || pipingType === 'one_pipe_improved') {
        switch (hydraulicBalancing) {
            case 'none': return 0.7;
            case 'static_loop': return 0.4;
            case 'dynamic_loop': return 0.3;
            case 'dynamic_return_temp': return 0.2;
            case 'dynamic_delta_temp': return 0.1;
            // 이전 호환: 기존 'static'/'dynamic' 값도 매핑
            case 'static': return 0.4;
            case 'dynamic': return 0.3;
            default: return 0.4;
        }
    }

    // 2관식 (Zweirohrnetz) — 기본
    switch (hydraulicBalancing) {
        case 'none': return 0.6;
        case 'static': return nOver10 ? 0.4 : 0.3;
        case 'static_group_static': return nOver10 ? 0.3 : 0.2;
        case 'static_group_dynamic': return nOver10 ? 0.2 : 0.1;
        case 'dynamic': return 0.0;
        default: return nOver10 ? 0.4 : 0.3;
    }
}

// ─── 표 12: Δθ_roomaut (실내 자동화 보정) ───

function getRoomAutomationDelta(roomAutomation: RoomAutomation): number {
    switch (roomAutomation) {
        case 'none': return 0.0;
        case 'time_control': return -0.5;
        case 'start_stop_optimized': return -1.0;
        case 'full_automation': return -1.2;
        default: return 0.0;
    }
}

// ─── 표 17: 급기 난방 통합 편차 (Δθ_str + Δθ_ctr + Δθ_emb) ───
// 6.2.2.4.6절 Zuluftnachheizung (층고 ≤ 4m 비주거 공간)

function getSupplyAirIntegratedDelta(
    controlVariable: 'room_temp' | 'room_temp_cascade' | 'exhaust_temp',
    controlQuality: 'low' | 'high'
): number {
    const table17: Record<string, Record<string, number>> = {
        room_temp: { low: 1.8, high: 1.3 },
        room_temp_cascade: { low: 1.2, high: 1.0 },
        exhaust_temp: { low: 1.9, high: 1.5 },
    };
    return table17[controlVariable]?.[controlQuality] ?? 1.8;
}

// ─── 표 18: 독립형 전기 난방 통합 편차 (Δθ_str + Δθ_ctr + Δθ_emb) ───
// 6.2.2.4.7절 Freistehende Elektroheizungen (층고 ≤ 4m)

export function getElectricHeaterIntegratedDelta(
    heaterType: 'direct' | 'storage',
    position: 'exterior' | 'interior',
    control: 'none' | 'p' | 'pi' | 'pid'
): number {
    // 표 18 값 매핑: [heaterType][control][position]
    if (heaterType === 'direct') {
        // 직접 난방: P-제어기(1K) 또는 PI-제어기(최적화)
        if (control === 'pi' || control === 'pid') {
            return position === 'exterior' ? 0.7 : 1.1;
        }
        // P-제어기 또는 기본
        return position === 'exterior' ? 1.1 : 1.5;
    }
    // 축열식 난방
    if (control === 'pid') {
        // PID-제어기 (최적화 + 외기온도 의존 충전)
        return position === 'exterior' ? 1.1 : 1.5;
    }
    if (control === 'p' || control === 'pi') {
        // P-제어기 (외기온도 의존 충전 등)
        return position === 'exterior' ? 1.5 : 1.9;
    }
    // 실내 온도 제어 없음
    return position === 'exterior' ? 2.7 : 3.1;
}

// ─── 수력 평형 계수 (f_hydr) ───

export function getHydraulicFactor(
    hydraulicBalancing: HydraulicBalancing,
    pipingType: PipingType = 'two_pipe',
    emitterCount: number = 10
): number {
    // Δθ_hydr 기반으로 f_hydr 비례 산정
    // 미조치(0.6K) → 1.06, 완전동적(0K) → 1.00
    const delta = getHydraulicDelta(hydraulicBalancing, pipingType, emitterCount);
    // 범위: 0.0~0.7 → f_hydr: 1.00~1.07 (선형 비례)
    return 1.0 + delta * 0.1;
}

// ─── 메인 계산 함수 ───

export function calculateEmissionLoss(input: EmissionLossInput): EmissionLossResult {
    const {
        Q_h_b,
        theta_i,
        theta_e,
        spaceCategory = 'standard',
        emitterType,
        pipingType = 'two_pipe',
        radiatorPosition = 'exterior_wall_opaque',
        sunProtection = true,
        temperatureRegime = '70/50',
        embeddingType = 'wet',
        floorInsulation = 'standard',
        hallAirSubType = 'low_temp_horizontal',
        infraredSubType = 'standard',
        ceilingPanelSubType = 'standard',
        roomHeight = 3.0,
        controlType = 'p_control',
        isCertified = false,
        roomAutomation = 'none',
        hydraulicBalancing = 'static',
        emitterCount = 10,
        hasVentilationLink = false,
        isIntermittent,
        tabsControlType = 'constant_temp',
        hallFloorDepth = 'shallow',
        hallFloorInsulation = 'min1',
        hallHeatingLoad = 50,
        radiationFactor: inputRadiationFactor = 0.5,
    } = input;

    let radiationFactor = inputRadiationFactor;

    // DIN/TS 18599-5:2025-10 Table 19: 복사 난방기(Infrared Radiant)의 복사 효율(RF) 자동 매핑
    // 등급(infraredSubType)에 따라 결정되며, 유형(Hellstrahler/Dunkelstrahler)에는 의존하지 않음.
    if (emitterType === 'infrared_radiant') {
        if (infraredSubType === 'improved') {
            radiationFactor = 0.69;
        } else {
            // 기본값 또는 'standard'인 경우
            radiationFactor = 0.55;
        }
    }

    // 간헐 운전 여부 추정 (입력이 없으면 자동화 수준으로 파악)
    const isInterm = isIntermittent !== undefined
        ? isIntermittent
        : ['time_control', 'start_stop_optimized', 'full_automation'].includes(roomAutomation);

    // 각 온도 편차 산출
    let delta_theta_str = getStratificationDelta({
        emitterType, spaceCategory, pipingType, radiatorPosition, sunProtection,
        temperatureRegime, hasVentilationLink, roomHeight,
        hallAirSubType, infraredSubType, ceilingPanelSubType
    });
    let delta_theta_ctr = getControlDelta(controlType, pipingType, isCertified);
    let delta_theta_emb = getEmbeddingDelta(emitterType, embeddingType, floorInsulation);
    let delta_theta_rad = getRadiationDelta(roomHeight, emitterType, spaceCategory, ceilingPanelSubType, radiationFactor, hallHeatingLoad);
    let delta_theta_im = getIntermittentDelta(isInterm, spaceCategory, emitterType, embeddingType);
    let delta_theta_hydr = getHydraulicDelta(hydraulicBalancing, pipingType, emitterCount);
    let delta_theta_roomaut = getRoomAutomationDelta(roomAutomation);

    // 대공간 시스템 매립 편차 덮어쓰기 (표 19)
    if (spaceCategory === 'hall' && ['ceiling_radiant_panel', 'hall_floor_heating'].includes(emitterType)) {
        delta_theta_emb = getHallEmbeddingDelta(emitterType, ceilingPanelSubType, hallFloorDepth, hallFloorInsulation);
    }

    // [신규] TABS (콘크리트코어 활성화) 전용 통합 계산 (표 16 적용)
    if (emitterType === 'tabs') {
        const isCentral = tabsControlType === 'central_or_electric';
        const tabsIntegratedDelta = isCentral ? 2.7 : 3.0;

        // TABS는 표 16에 의해 str, ctr, emb 가 하나로 통합 부여됨
        delta_theta_str = tabsIntegratedDelta;
        delta_theta_ctr = 0;
        delta_theta_emb = 0;
        // 매우 높은 열용량으로 인해 간헐/자동화 등 기타 보상 불가 (0K 고정)
        delta_theta_rad = 0;
        delta_theta_im = 0;
        delta_theta_roomaut = 0;

        // [수정] TABS도 수냉식 배관 시스템이므로 수력 편차는 별도 산출 (6.2.2.2절 적용)
        delta_theta_hydr = getHydraulicDelta(hydraulicBalancing, pipingType, emitterCount);
    }

    // [신규] 급기 난방 (Zuluftnachheizung) 전용 통합 계산 (표 17, 6.2.2.4.6절)
    if (emitterType === 'supply_air') {
        const supplyAirDelta = getSupplyAirIntegratedDelta(
            input.supplyAirControlVariable || 'room_temp',
            input.supplyAirControlQuality || 'low'
        );
        delta_theta_str = supplyAirDelta;
        delta_theta_ctr = 0;
        delta_theta_emb = 0;
        // 공기 매질이므로 rad, im, roomaut 모두 0K (6.2.2.4.6절)
        delta_theta_rad = 0;
        delta_theta_im = 0;
        delta_theta_roomaut = 0;
        // 공기 매질이므로 수력 불균형도 해당 없음
        delta_theta_hydr = 0;
    }

    // [신규] 독립형 전기 난방 전용 통합 계산 (표 18, 6.2.2.4.7절)
    if (emitterType === 'electric_heater') {
        const hType = input.electricHeaterType || 'direct';
        const hPos = input.electricHeaterPosition || 'exterior';
        const hCtrl = input.electricHeaterControl || 'p';

        delta_theta_str = getElectricHeaterIntegratedDelta(hType, hPos, hCtrl);
        delta_theta_ctr = 0;
        delta_theta_emb = 0;

        // 공기/전기 매질이므로 rad, roomaut는 0K
        delta_theta_rad = 0;
        delta_theta_roomaut = 0;

        // 간헐 운전이 활성화되어 있으면 -0.3K 혜택 (6.2.2.4.7절 본문)
        delta_theta_im = isInterm ? -0.3 : 0;

        // 배관망이 없으므로 수력 불균형 해당 없음
        delta_theta_hydr = 0;
    }

    // 총 온도 편차 (음수 허용: 우수 제어/자동화에 의한 에너지 절감 보상)
    const delta_theta_ce = delta_theta_str + delta_theta_ctr + delta_theta_emb +
        delta_theta_rad + delta_theta_im +
        delta_theta_hydr + delta_theta_roomaut;

    const dT_ie = theta_i - theta_e;
    let Q_h_ce = 0;
    if (dT_ie > 0 && Q_h_b > 0) {
        Q_h_ce = Q_h_b * (delta_theta_ce / dT_ie);
    }

    const f_hydr = getHydraulicFactor(hydraulicBalancing, pipingType, emitterCount);

    // [신규] 적용값 레이블 생성 (UI 표시용)
    const tempLabel = (emitterType === 'radiator' || emitterType === 'convector' || emitterType === 'fcu') ? ` / ${temperatureRegime}` : '';
    const specialLabel = hasVentilationLink ? ' / 환기연동' : (emitterType === 'fcu' ? ' / FCU보상' : '');

    let labels = {
        control: `${getPipingLabel(pipingType)} / ${getControlLabel(controlType)}${isCertified ? ' (인증)' : ''} (${delta_theta_ctr.toFixed(1)}K)`,
        hydraulic: `${getHydraulicLabel(hydraulicBalancing, pipingType, emitterCount)} (${delta_theta_hydr.toFixed(1)}K)`,
        automation: `${getAutomationLabel(roomAutomation)} (${delta_theta_roomaut.toFixed(1)}K)`,
        stratification: `${getEmitterLabel(emitterType)} / ${getRadiatorPosLabel(radiatorPosition)}${tempLabel}${specialLabel} (${delta_theta_str.toFixed(1)}K)`,
        embedding: '-',
    };

    if (emitterType === 'tabs') {
        const tabsName = tabsControlType === 'central_or_electric' ? '중앙/전기식 제어' : '일정 공급온도 제어';
        labels = {
            ...labels,
            control: `통합 처리됨`,
            embedding: `통합 처리됨`,
            stratification: `TABS 통합편차 (${tabsName}) (${delta_theta_str.toFixed(1)}K)`,
            automation: `TABS 열용량으로 무효화 (0.0K)`
        };
    }

    if (emitterType === 'supply_air') {
        const ctrlVarLabel: Record<string, string> = {
            room_temp: '실내 온도 기준',
            room_temp_cascade: '실내 온도 + 캐스케이드',
            exhaust_temp: '배기 온도 기준',
        };
        const qualLabel = (input.supplyAirControlQuality || 'low') === 'high' ? '높음' : '낮음';
        labels = {
            ...labels,
            control: `통합 처리됨`,
            embedding: `통합 처리됨`,
            stratification: `급기 난방 표 17 (${ctrlVarLabel[input.supplyAirControlVariable || 'room_temp']}, 품질 ${qualLabel}) (${delta_theta_str.toFixed(1)}K)`,
            automation: `급기 난방 - 해당 없음 (0.0K)`,
            hydraulic: `공기 매질 - 해당 없음 (0.0K)`,
        };
    }

    if (emitterType === 'electric_heater') {
        const typeLabel = input.electricHeaterType === 'storage' ? '축열식' : '직접 가열식';
        const posLabel = input.electricHeaterPosition === 'interior' ? '내벽' : '외벽';
        let ctrlLabel = '없음';

        if (input.electricHeaterType === 'storage') {
            if (input.electricHeaterControl === 'none') ctrlLabel = '실내 온도 제어 없음';
            else if (input.electricHeaterControl === 'pid') ctrlLabel = 'PID-제어기 (최적화/외기보상)';
            else ctrlLabel = 'P-제어기 (1K/외기보상)';
        } else {
            if (input.electricHeaterControl === 'pi' || input.electricHeaterControl === 'pid') ctrlLabel = 'PI-제어기 (최적화)';
            else ctrlLabel = 'P-제어기 (1K)';
        }

        labels = {
            ...labels,
            control: `통합 처리됨`,
            embedding: `통합 처리됨`,
            stratification: `표 18 전기난방 (${typeLabel}, ${posLabel}, ${ctrlLabel}) (${delta_theta_str.toFixed(1)}K)`,
            automation: `전기기기 자체제어 (0.0K)`,
            hydraulic: `배관 없음 (0.0K)`,
        };
    }

    // [6.2.2.4.9절] 대공간 기존 건물 라디에이터
    if (emitterType === 'hall_radiator') {
        // 쵸화 편차는 식 41에서 이미 처리됨 (구배 1.0 K/m)
        // emb, rad, im 모두 0K (6.2.2.4.9절)
        delta_theta_emb = 0;
        delta_theta_rad = 0;
        delta_theta_im = 0;
        // ctr, hydr, roomaut는 일반 라디에이터 규칙 그대로 (표 10, 11, 12)

        labels = {
            ...labels,
            stratification: `대공간 라디에이터 6.2.2.4.9절 (구배 1.0K/m) (${delta_theta_str.toFixed(1)}K)`,
            embedding: `대공간 라디에이터 - 해당 없음 (0.0K)`,
        };
    }

    // [신규] 대공간 상세 변수 캡처용 객체 구성
    const isHallSystem = ['ceiling_radiant_panel', 'infrared_radiant', 'hall_air'].includes(emitterType as any);
    const hallDetails = isHallSystem ? {
        theta_str_prime: getHallTemperatureGradient(
            emitterType, hallAirSubType, infraredSubType, ceilingPanelSubType
        ),
        h_R: roomHeight,
        p_h: hallHeatingLoad,
        RF: radiationFactor,
    } : undefined;

    return {
        Q_h_ce,
        delta_theta_ce,
        delta_theta_str,
        delta_theta_ctr,
        delta_theta_emb,
        delta_theta_rad,
        delta_theta_im,
        delta_theta_hydr,
        delta_theta_roomaut,
        f_hydr,
        labels,
        emissionHallDetails: hallDetails,
    };
}

// ─── 레이블 헬퍼 함수들 (한국어) ───

function getPipingLabel(t: PipingType): string {
    const map: Record<PipingType, string> = {
        'two_pipe': '2관식',
        'one_pipe_improved': '1관식(개선형)',
        'one_pipe': '1관식(미개선)',
        'distributed': '분산형'
    };
    return map[t] || t;
}

function getControlLabel(t: ControlType): string {
    const map: Record<ControlType, string> = {
        'manual': '수동/제어없음',
        'central': '중앙 제어',
        'electromechanical': '2위식(기계식)',
        'p_control': 'P-제어기(전자식)',
        'pi_control': 'PI-제어기',
        'pi_optimized': 'PI-제어기(최적)'
    };
    return map[t] || t;
}

function getHydraulicLabel(h: HydraulicBalancing, p: PipingType, n: number): string {
    // 1관식
    if (p === 'one_pipe' || p === 'one_pipe_improved') {
        const map: Record<string, string> = {
            'none': '미조치',
            'static_loop': '회로별 정적 평형',
            'dynamic_loop': '회로별 동적 평형',
            'dynamic_return_temp': '환수온도 동적 평형',
            'dynamic_delta_temp': '차온 동적 평형'
        };
        return map[h] || h;
    }
    // 2관식
    const suffix = n > 10 ? '(n>10)' : '(n≤10)';
    const map: Record<string, string> = {
        'none': '미조치',
        'static': '정적 평형' + suffix,
        'static_group_static': '정적+그룹정적',
        'static_group_dynamic': '정적+그룹동적',
        'dynamic': '완전 동적 평형'
    };
    return map[h] || h;
}

function getAutomationLabel(a: RoomAutomation): string {
    const map: Record<RoomAutomation, string> = {
        'none': '미적용',
        'time_control': '시간 제어',
        'start_stop_optimized': '최적 가동/정지',
        'full_automation': '전체 자동화'
    };
    return map[a] || a;
}

function getEmitterLabel(e: EmitterType): string {
    const map: Record<EmitterType, string> = {
        'radiator': '방열기', 'convector': '컨벡터', 'fcu': '팬코일',
        'floor_heating': '바닥난방', 'wall_heating': '벽체난방', 'ceiling_heating': '천장난방',
        'tabs': 'TABS', 'supply_air': '급기난방', 'electric_heater': '전기난방',
        'hall_air': '대공간공기', 'infrared_radiant': '적외선복사', 'ceiling_radiant_panel': '천장패널',
        'hall_floor_heating': '대공간바닥', 'hall_radiator': '대공간라디에이터'
    };
    return map[e] || e;
}

function getRadiatorPosLabel(p: RadiatorPosition): string {
    const map: Record<RadiatorPosition, string> = {
        'interior_wall': '내벽 설치',
        'exterior_wall_opaque': '외벽(불투명) 설치',
        'exterior_wall_transparent': '외벽(창호앞) 설치'
    };
    return map[p] || p;
}
