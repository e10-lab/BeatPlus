import { ClimateData, HourlyClimate, MonthlyClimate } from "./types";
import { parseEPW, EPWHourlyData } from "@/lib/epw-parser";

// 서울 기상 데이터 (대표 기상년 근사치)
const SEOUL_CLIMATE: ClimateData = {
    name: "서울",
    latitude: 37.5,
    monthly: [
        { month: 1, Te: -2.4, Is_Horiz: 65 },  // 1월
        { month: 2, Te: 0.4, Is_Horiz: 90 },   // 2월
        { month: 3, Te: 5.7, Is_Horiz: 125 },  // 3월
        { month: 4, Te: 12.5, Is_Horiz: 155 }, // 4월
        { month: 5, Te: 17.8, Is_Horiz: 170 }, // 5월
        { month: 6, Te: 22.2, Is_Horiz: 165 }, // 6월
        { month: 7, Te: 24.9, Is_Horiz: 150 }, // 7월
        { month: 8, Te: 25.7, Is_Horiz: 155 }, // 8월
        { month: 9, Te: 21.2, Is_Horiz: 135 }, // 9월
        { month: 10, Te: 14.8, Is_Horiz: 115 }, // 10월
        { month: 11, Te: 7.2, Is_Horiz: 75 },  // 11월
        { month: 12, Te: 0.4, Is_Horiz: 60 }   // 12월
    ]
};

const STATION_NAME_MAP: Record<number, string> = {
    470900: "속초",
    470950: "철원",
    470980: "동두천",
    470990: "파주",
    471000: "대관령",
    471010: "춘천",
    471020: "백령도",
    471040: "북강릉",
    471050: "강릉",
    471080: "서울",
    471120: "양평",
    471140: "원주",
    471150: "울릉도",
    471190: "수원",
    471270: "충주",
    471290: "서산",
    471310: "청주",
    471330: "대전",
    471350: "추풍령",
    471360: "안동",
    471380: "포항",
    471430: "대구",
    471460: "전주",
    471520: "울산",
    471560: "광주",
    471590: "부산",
    471650: "목포",
    471680: "여수",
    471840: "제주",
};

// 헬퍼: 각 월의 일수
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * 월평균 데이터로부터 시간별 합성(Synthetic) 기상 데이터를 생성합니다.
 * EPW 파일이 없을 때 표준 기상년 시뮬레이션을 수행하기 위한 간이 생성기입니다.
 */
export function generateHourlyClimateData(monthly: MonthlyClimate[]): HourlyClimate[] {
    const hourlyData: HourlyClimate[] = [];
    let hourOfYear = 1;

    // 서울의 근사 일교차 (K)
    const DIURNAL_SWING = 8.0;

    monthly.forEach((m, index) => {
        const days = DAYS_IN_MONTH[index];
        // 월간 일사량 합계로부터 일평균 일사밀도 계산 [kWh/m²/day]
        const dailySolarAvg_kWh = m.Is_Horiz / days;

        for (let d = 1; d <= days; d++) {
            for (let h = 0; h < 24; h++) {
                // 1. 기온 생성 (정현파 곡선 기반)
                // 최저 기온은 오전 4-5시경, 최고 기온은 오후 2-3시경으로 가정
                const tempSwing = (DIURNAL_SWING / 2) * Math.cos(((h - 15) * Math.PI) / 12);

                // 현재 시간의 기온 산출
                const T_hour = m.Te + tempSwing;

                // 2. 일사량 생성 (간략화된 시간별 배분)
                // 주간 시간에 반원(Half-Sine) 형태로 배분
                let I_gh = 0; // 수형면 전일사량 (Global Horizontal)

                const sunrise = 6;
                const sunset = 19;
                if (h > sunrise && h < sunset) {
                    const totalDaylight = sunset - sunrise;
                    const hourFromNoon = Math.abs(12.5 - h);

                    // 코사인 분포 가중치 계산
                    const weight = Math.cos((hourFromNoon / (totalDaylight / 2)) * (Math.PI / 2));
                    if (weight > 0) {
                        // 일평균 일사량을 시간당 평균 전력[W]으로 변환하여 가중치 적용
                        const peakIrradiance = (dailySolarAvg_kWh * 1000) / (totalDaylight * 0.65);
                        I_gh = peakIrradiance * weight;
                    }
                }

                // 직달과 확산 일사 분리 (일반적인 확산 분율 0.5 가정)
                const diffuseFraction = 0.5;
                const I_diff = I_gh * diffuseFraction;
                const I_beam = I_gh * (1 - diffuseFraction);

                // 태양 위치 근사치 (시각화를 위한 더미 값, 실제 계산에서는 별도 모듈 사용)
                const sunAlt = h > sunrise && h < sunset ? 45 : 0;
                const sunAz = 180 + (h - 12) * 15;

                hourlyData.push({
                    hourOfYear: hourOfYear++,
                    month: m.month,
                    day: d,
                    hour: h,
                    Te: T_hour,
                    I_beam: I_beam,
                    I_diff: I_diff,
                    sunAltitude: sunAlt,
                    sunAzimuth: sunAz
                });
            }
        }
    });

    return hourlyData;
}


export const getClimateData = (region: string = "Seoul"): ClimateData => {
    // 메모리 절약을 위해 요청 시마다 생성
    const hourly = generateHourlyClimateData(SEOUL_CLIMATE.monthly);
    return {
        ...SEOUL_CLIMATE,
        hourly: hourly
    };
};

export async function loadClimateData(stationId: number): Promise<ClimateData> {
    try {
        const response = await fetch(`/weather-data/${stationId}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load weather data for station ${stationId}`);
        }
        const data = await response.json();

        // ClimateData 인터페이스 형식 보장
        const baseName = data.name || data.metadata?.name || `Station ${stationId}`;
        const displayName = STATION_NAME_MAP[stationId] || baseName;
        const latitude = data.latitude || data.metadata?.latitude || 37.5;

        let hourlyData: HourlyClimate[] | undefined = data.hourly;

        // EPW 파일이 있고 fetch 가능한 경우 로드
        if (data.filename) {
            try {
                const epwResponse = await fetch(`/epw/${data.filename}`);
                if (epwResponse.ok) {
                    const epwText = await epwResponse.text();
                    const parsedEPW = parseEPW(epwText);

                    // EPW 데이터를 HourlyClimate 형식으로 변환
                    hourlyData = parsedEPW.hourly.map(h => {
                        // 날짜로부터 Day of Year 계산 (Approximate)
                        // Note: epw-parser returns standard dates.
                        // We can calculate rough hourOfYear or use strictly from index if sequential.
                        // EPW usually starts Jan 1st 01:00.

                        // Solar Geometry is calculated in Calculator, but we need basic params.
                        // HourlyClimate definition: 
                        // Te, I_beam, I_diff are critical.
                        // I_beam in Calculator expects Horizontal or Normal?
                        // generateDailyProfile logic: I_beam = I_global * (1 - k_d) -> Horizontal.
                        // calculateHourlyRadiationDetailed logic:
                        // input Ib is "Horizontal Beam" or "Normal Beam"?
                        // comment line 1774: "Ib: number, // 수평면 직달일사 (W/m2)"
                        // So we must provide Horizontal Beam.
                        // EPW provides Direct Normal ($I_{bn}$).
                        // Relation: $I_{bh} = I_{bn} * \sin(\alpha)$.
                        // BUT, calculator calculates alpha internally.
                        // If we pass $I_{bn}$ as $I_b$ to `calculateHourlyRadiationDetailed`, 
                        // line 1829: `Ib_surf = Ib * Rb`.
                        // Rb = max(cos, 0) / max(sin, 0) approx cos(theta)/sin(alpha).
                        // Ib * Rb = Ib_horiz * (cos_theta / sin_alpha) = (I_bn * sin_alpha) * (cos_theta / sin_alpha) = I_bn * cos_theta. CORRECT.
                        // So the calculator EXPECTS Horizontal Beam.
                        // We have Global Horizontal and Diffuse Horizontal from EPW.
                        // $I_{beam_horiz} = I_{global_horiz} - I_{diffuse_horiz}$.
                        // This is safer than converting Normal using separate solar algo.

                        const I_gh = h.globalHoriz;
                        const I_dh = h.diffuseHoriz;
                        const I_bh = Math.max(0, I_gh - I_dh);

                        return {
                            hourOfYear: 0, // Assigned later or ignored
                            month: h.month,
                            day: h.day,
                            hour: h.hour,
                            Te: h.dryBulb,
                            I_beam: I_bh, // Passing Horizontal Beam
                            I_diff: I_dh,
                            sunAltitude: 0, // Will be recalc-ed
                            sunAzimuth: 0   // Will be recalc-ed
                        };
                    });

                    console.log(`Loaded EPW data for ${displayName}: ${hourlyData.length} hours`);
                }
            } catch (e) {
                console.warn("Failed to load EPW file:", e);
            }
        }

        return {
            name: displayName,
            latitude: latitude,
            monthly: data.monthly,
            hourly: hourlyData
        };
    } catch (error) {
        console.warn(`기상 데이터 로드 실패 (${stationId}), 기본 서울 데이터를 사용합니다.`, error);
        return getClimateData();
    }
}
