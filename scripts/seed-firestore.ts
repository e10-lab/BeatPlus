import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, writeBatch, collection } from "firebase/firestore";
import * as dotenv from 'dotenv';
import { DIN_18599_PROFILES } from "../src/lib/din-18599-profiles";
import { KOREA_WEATHER_STATIONS } from "../src/lib/climate-data";
import { DEFAULT_MATERIALS } from "../src/lib/materials";

// .env.local 파일에서 환경 변수 로드
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedData() {
    console.log("데이터 시딩(Seeding) 시작...");
    console.log(`대상 프로젝트: ${firebaseConfig.projectId}`);

    try {
        // 1. 용도 프로필(Usage Profiles) 데이터 업로드
        console.log("용도 프로필 데이터를 업로드 중...");
        const profilesBatch = writeBatch(db);
        let profileCount = 0;

        for (const [key, profile] of Object.entries(DIN_18599_PROFILES)) {
            const ref = doc(db, "usage_profiles", profile.id);
            profilesBatch.set(ref, profile);
            profileCount++;
        }
        await profilesBatch.commit();
        console.log(`✅ ${profileCount}개의 용도 프로필 업로드 완료.`);

        // 2. 기상 관측소(Weather Stations) 데이터 업로드
        console.log("기상 관측소 데이터를 업로드 중...");
        const weatherBatch = writeBatch(db);
        let weatherCount = 0;

        for (const station of KOREA_WEATHER_STATIONS) {
            const ref = doc(db, "climate_stations", station.id.toString());
            weatherBatch.set(ref, station);
            weatherCount++;
        }
        await weatherBatch.commit();
        console.log(`✅ ${weatherCount}개의 기상 관측소 정보 업로드 완료.`);

        // 3. 자재(Materials) 데이터 업로드
        console.log("자재 라이브러리 데이터를 업로드 중...");
        // Firestore 일괄 처리(Batch)는 한 번에 500개 작업으로 제한됨
        // 현재 DEFAULT_MATERIALS는 약 200개 미만임
        const materialsBatch = writeBatch(db);
        let materialCount = 0;

        for (const material of DEFAULT_MATERIALS) {
            const ref = doc(db, "materials", material.id);
            materialsBatch.set(ref, material);
            materialCount++;
        }
        await materialsBatch.commit();
        console.log(`✅ ${materialCount}개의 자재 정보 업로드 완료.`);

        console.log("🎉 모든 데이터 시딩 작업이 성공적으로 완료되었습니다!");
    } catch (error) {
        console.error("❌ 데이터 업로드 중 오류 발생:", error);
        process.exit(1);
    }
}

seedData();
