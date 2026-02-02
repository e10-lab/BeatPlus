import fs from 'fs';
import path from 'path';
import { HourlyClimate, MonthlyClimate } from '../src/engine/types';

// 상수 정의
const EPW_DIR = path.join(process.cwd(), 'epw');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'weather-data');
const METADATA_FILE = path.join(process.cwd(), 'src', 'lib', 'stations.json');

// 관측소 메타데이터 인터페이스
interface StationMetadata {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    elevation: number;
    filename: string;
    monthlyTemp: number[];
    monthlySolar: number[];
}

// 단일 EPW 파일을 파싱하는 함수
function parseEpw(filePath: string, filename: string): { metadata: StationMetadata, hourly: HourlyClimate[], monthly: MonthlyClimate[] } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // 1. 위치 헤더 파싱 (첫 번째 줄)
    // 예: LOCATION,Seoul.WS,SO,KOR,SRC-TMYx,471080,37.57140,126.9658,9.0,87.1
    const locLine = lines[0].split(',');
    const name = locLine[1];
    const id = parseInt(locLine[5]);
    const latitude = parseFloat(locLine[6]);
    const longitude = parseFloat(locLine[7]);
    const timezone = parseFloat(locLine[8]);
    const elevation = parseFloat(locLine[9]);

    const metadata: StationMetadata = {
        id,
        name,
        latitude,
        longitude,
        elevation,
        filename
    } as any; // 부분 초기화를 위해 any 타입 캐스팅

    // 2. 기상 데이터 파싱 (9번째 줄부터 시작)
    const hourly: HourlyClimate[] = [];
    const monthlyAcc: { [key: number]: { tempSum: number, solarSum: number, count: number } } = {};

    let hourOfYear = 1;

    for (let i = 8; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',');
        // 숫자가 아닌 라인은 건너뜀 (헤더나 설명글 등)
        if (isNaN(parseInt(cols[0]))) continue;

        const month = parseInt(cols[1]);
        const day = parseInt(cols[2]);
        const hour = parseInt(cols[3]);

        // EPW 데이터 열 인덱스 참조:
        // 6: 건구 온도 (Dry Bulb, °C)
        // 13: 수평면 전일사량 (Global Horizontal, Wh/m²)
        // 14: 법선 직달 일사량 (Direct Normal, Wh/m²)
        // 15: 수평면 확산 일사량 (Diffuse Horizontal, Wh/m²)

        const Te = parseFloat(cols[6]);
        const I_gh = parseFloat(cols[13]); // 수평면 전일사량
        const I_dn = parseFloat(cols[14]); // 법선 직달 일사량 (Direct Normal)
        const I_dh = parseFloat(cols[15]); // 수평면 확산 일사량 (Diffuse Horizontal)

        // HourlyClimate 인터페이스에 맞춰 데이터 저장
        // I_beam은 법선 직달 일사량(Direct Normal), I_diff는 수평면 확산 일사량으로 설정
        hourly.push({
            hourOfYear,
            month,
            day,
            hour,
            Te,
            I_beam: I_dn,
            I_diff: I_dh,
            // 태양 위치는 엔진에서 런타임에 계산하므로 초기값은 0으로 설정
            sunAltitude: 0,
            sunAzimuth: 0
        });

        // 월별 통계 집계
        if (!monthlyAcc[month]) monthlyAcc[month] = { tempSum: 0, solarSum: 0, count: 0 };
        monthlyAcc[month].tempSum += Te;
        monthlyAcc[month].solarSum += (I_gh); // 월별 합계를 위해 수평면 전일사량 합산
        monthlyAcc[month].count++;

        hourOfYear++;
    }

    const monthly: MonthlyClimate[] = [];
    const monthlyTemp: number[] = [];
    const monthlySolar: number[] = [];

    for (let m = 1; m <= 12; m++) {
        const stats = monthlyAcc[m];
        if (stats) {
            const avgTemp = stats.tempSum / stats.count;
            const totalSolar = stats.solarSum / 1000;

            monthly.push({
                month: m,
                Te: avgTemp,
                // 월간 수평면 전일사량 (Wh/m² -> kWh/m²/month)
                Is_Horiz: totalSolar
            });
            monthlyTemp.push(parseFloat(avgTemp.toFixed(1)));
            monthlySolar.push(parseFloat(totalSolar.toFixed(1)));
        } else {
            monthlyTemp.push(0);
            monthlySolar.push(0);
        }
    }

    metadata.monthlyTemp = monthlyTemp;
    metadata.monthlySolar = monthlySolar;

    return { metadata, hourly, monthly };
}

// 메인 실행 로직
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const files = fs.readdirSync(EPW_DIR).filter(f => f.endsWith('.epw'));
const stations: StationMetadata[] = [];

console.log(`${files.length}개의 EPW 파일 처리를 시작합니다...`);

for (const file of files) {
    try {
        const { metadata, hourly, monthly } = parseEpw(path.join(EPW_DIR, file), file);
        stations.push(metadata);

        // 시간별 및 월별 기상 데이터 저장
        const weatherData = {
            ...metadata,
            monthly,
            hourly
        };

        fs.writeFileSync(path.join(OUTPUT_DIR, `${metadata.id}.json`), JSON.stringify(weatherData));
        process.stdout.write('.');
    } catch (e) {
        console.error(`\n파일 처리 오류 (${file}):`, e);
    }
}

// 관측소 메타데이터 레지스트리 저장
fs.writeFileSync(METADATA_FILE, JSON.stringify(stations, null, 2));

console.log(`\n완료. 총 ${stations.length}개의 관측소 데이터가 처리되었습니다.`);
