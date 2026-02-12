import { PVSystem } from "@/types/system";
import { calculateHourlyRadiation } from "./solar-calc";

/**
 * 시간당 태양광 발전량 계산 (DIN/TS 18599-9:2025-10)
 * AC 에너지 발전량 [Wh]을 산출합니다.
 */

export interface PVResult {
    hourlyGeneration: number[]; // 시간별 발전량 (Wh)
    totalGeneration: number; // 총 발전량 (Wh)
}

export function calculateHourlyPV(
    system: PVSystem,
    hourlyWeather: { Te: number, I_beam: number, I_diff: number, day: number, hour: number }[],
    latitude: number = 37.5
): PVResult {
    const hourlyGen = new Array(hourlyWeather.length).fill(0);
    let totalGen = 0;

    // 시스템의 각 어레이(Array)별로 반복 계산
    system.arrays.forEach(array => {
        const capacityW = array.capacity * 1000; // kWp -> Wp 변환
        const pr = array.performanceRatio || 0.75; // 성능 계수 (Performance Ratio)
        let tilt = array.tilt;

        // 방위 문자열을 방위각(도)으로 매핑
        let azimuth = 0; // 남측=0
        switch (array.orientation) {
            case 'S': azimuth = 0; break;
            case 'E': azimuth = -90; break;
            case 'W': azimuth = 90; break;
            case 'N': azimuth = 180; break;
            case 'SE': azimuth = -45; break;
            case 'SW': azimuth = 45; break;
            case 'NE': azimuth = -135; break;
            case 'NW': azimuth = 135; break;
            case 'Horiz': azimuth = 0; break; // 평면인 경우 방위 상관없음
            default: azimuth = 0;
        }
        if (array.orientation === 'Horiz') tilt = 0; // 평면이면 경사각 0으로 강제

        for (let i = 0; i < hourlyWeather.length; i++) {
            const w = hourlyWeather[i];

            // 1. 입사 일사량 계산
            const I_surf = calculateHourlyRadiation(
                w.I_beam,
                w.I_diff,
                w.day,
                w.hour,
                latitude,
                azimuth,
                tilt
            );

            // 2. 발전량 공식 적용
            // E_pv = I_surf * (P_pk / I_stc) * PR
            // I_stc = 1000 W/m² (표준 측정 조건)
            // P_pk = 설치 용량(Watts)
            // 결과는 Wh 단위 (계산 간격이 1시간이므로)

            // 간략화된 온도 보정 (MVP 단계에서는 고정 PR 사용으로 생략)

            if (I_surf > 0) {
                const gen = I_surf * (capacityW / 1000) * pr;
                hourlyGen[i] += gen;
                totalGen += gen;
            }
        }
    });

    return {
        hourlyGeneration: hourlyGen,
        totalGeneration: totalGen
    };
}
