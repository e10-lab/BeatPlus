/**
 * DIN/TS 18599-5:2025-10 6.4절 — 난방 축열조(버퍼 탱크) 손실 계산
 *
 * 식(69): Q_h,s = f_con × (θ_h,s − θ_l) / 45 × d_op,mth × Q_P0,s,day
 * 식(71): Q_P0,s,day = 0.4 + 0.14 × V_s^0.5  [kWh/d]
 *
 * f_con: 연결 배관 추가 손실 계수 (같은 공간 1.2, 다른 공간 1.0)
 * θ_h,s: 축열조 평균 온도 = θ_HK,av (Phase 1 산출값)
 * θ_l: 축열조 주변 온도 (표 24: 비난방 13°C, 난방 20°C)
 */

import type { SystemLossBreakdown } from '@/engine/types';

// ─── 타입 정의 ───

/** 축열조 설치 위치 */
export type StorageLocation = 'heated_space' | 'unheated_space';

/** 축열조 손실 계산 입력 */
export interface StorageLossInput {
    V_s: number;                     // 축열조 부피 (리터)
    theta_h_s: number;               // 축열조 평균 온도 (°C) = θ_HK,av
    storageLocation?: StorageLocation; // 설치 위치 (기본: 비난방)
    sameRoomAsGenerator?: boolean;   // 열원기와 같은 공간 (f_con 결정)
    d_op_mth: number;                // 월간 가동 일수 (일)
    Q_P0_spec?: number;              // 제조사 제공 일일 대기 손실 (kWh/d, 없으면 자동 산출)
}

/** 축열조 손실 계산 결과 */
export interface StorageLossResult {
    Q_h_s: number;                   // 월간 축열조 손실 (kWh)
    Q_P0_s_day: number;              // 일일 대기 손실 (kWh/d)
    f_con: number;                   // 연결 배관 계수
    theta_l: number;                 // 주변 온도 (°C)
    dT_storage: number;              // 온도차 (K)
    breakdown: SystemLossBreakdown;  // 검증 UI 호환
}

// ─── 핵심 계산 함수 ───

/**
 * 일일 대기 열손실 — DIN/TS 18599-5 식(71)
 * Q_P0,s,day = 0.4 + 0.14 × V_s^0.5  [kWh/d]
 */
export function calculateDailyStandbyLoss(V_s: number, Q_P0_spec?: number): number {
    if (Q_P0_spec && Q_P0_spec > 0) return Q_P0_spec;
    if (V_s <= 0) return 0;
    return 0.4 + 0.14 * Math.pow(V_s, 0.5);
}

/**
 * 축열조 주변 온도 — DIN/TS 18599-5 표 24
 */
function getAmbientTemperature(location: StorageLocation): number {
    return location === 'heated_space' ? 20 : 13;
}

/**
 * 연결 배관 계수 — DIN/TS 18599-5 6.4절
 * 열원기와 같은 공간: 1.2 (연결배관 추가 손실)
 * 다른 공간: 1.0
 */
function getConnectionFactor(sameRoom: boolean): number {
    return sameRoom ? 1.2 : 1.0;
}

/**
 * 난방 축열조 손실 계산 — DIN/TS 18599-5 식(69)
 *
 * Q_h,s = f_con × (θ_h,s − θ_l) / 45 × d_op,mth × Q_P0,s,day
 */
export function calculateStorageLoss(input: StorageLossInput): StorageLossResult {
    const {
        V_s,
        theta_h_s,
        storageLocation = 'unheated_space',
        sameRoomAsGenerator = true,
        d_op_mth,
        Q_P0_spec,
    } = input;

    if (V_s <= 0 || d_op_mth <= 0) {
        return {
            Q_h_s: 0, Q_P0_s_day: 0, f_con: 1.0, theta_l: 20, dT_storage: 0,
            breakdown: {
                total: { hours: 0, dT: 0, Q_loss: 0 },
                op: { hours: 0, dT: 0, Q_loss: 0 },
                non_op: { hours: 0, dT: 0, Q_loss: 0 },
                V_s: V_s, k_s: 0,
            },
        };
    }

    // 1. 일일 대기 손실 (식 71)
    const Q_P0_s_day = calculateDailyStandbyLoss(V_s, Q_P0_spec);

    // 2. 주변 온도 (표 24)
    const theta_l = getAmbientTemperature(storageLocation);

    // 3. 연결 배관 계수
    const f_con = getConnectionFactor(sameRoomAsGenerator);

    // 4. 온도차
    const dT_storage = Math.max(0, theta_h_s - theta_l);

    // 5. 식(69): Q_h,s = f_con × (θ_h,s − θ_l) / 45 × d_op × Q_P0,s,day
    const Q_h_s = f_con * (dT_storage / 45) * d_op_mth * Q_P0_s_day;

    // 6. SystemLossBreakdown 생성
    const totalHours = d_op_mth * 24;
    const breakdown: SystemLossBreakdown = {
        V_s: V_s,
        k_s: Q_P0_s_day,
        total: { hours: totalHours, dT: dT_storage, Q_loss: Q_h_s },
        op: { hours: totalHours, dT: dT_storage, Q_loss: Q_h_s },
        non_op: { hours: 0, dT: 0, Q_loss: 0 },
    };

    return { Q_h_s, Q_P0_s_day, f_con, theta_l, dT_storage, breakdown };
}
