import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, writeBatch, collection } from "firebase/firestore";
import * as dotenv from 'dotenv';
import { DIN_18599_PROFILES } from "../src/lib/din-18599-profiles";
import { KOREA_WEATHER_STATIONS } from "../src/lib/climate-data";
import { DEFAULT_MATERIALS } from "../src/lib/materials";

// Load environment variables from .env.local
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedData() {
    console.log("Starting data seeding...");
    console.log(`Writing to project: ${firebaseConfig.projectId}`);

    try {
        // 1. Seed Usage Profiles
        console.log("Seeding Usage Profiles...");
        const profilesBatch = writeBatch(db);
        let profileCount = 0;
        
        for (const [key, profile] of Object.entries(DIN_18599_PROFILES)) {
            const ref = doc(db, "usage_profiles", profile.id);
            profilesBatch.set(ref, profile);
            profileCount++;
        }
        await profilesBatch.commit();
        console.log(`✅ Seeded ${profileCount} usage profiles.`);

        // 2. Seed Weather Stations
        console.log("Seeding Weather Stations...");
        const weatherBatch = writeBatch(db);
        let weatherCount = 0;
        
        for (const station of KOREA_WEATHER_STATIONS) {
            const ref = doc(db, "climate_stations", station.id.toString());
            weatherBatch.set(ref, station);
            weatherCount++;
        }
        await weatherBatch.commit();
        console.log(`✅ Seeded ${weatherCount} weather stations.`);

        // 3. Seed Materials
        console.log("Seeding Materials...");
        // Batches have a limit of 500 operations. Materials might exceed this if we add more.
        // For now DEFAULT_MATERIALS is < 200 items.
        const materialsBatch = writeBatch(db);
        let materialCount = 0;

        for (const material of DEFAULT_MATERIALS) {
            const ref = doc(db, "materials", material.id);
            materialsBatch.set(ref, material);
            materialCount++;
        }
        await materialsBatch.commit();
        console.log(`✅ Seeded ${materialCount} materials.`);

        console.log("🎉 Data seeding completed successfully!");
    } catch (error) {
        console.error("❌ Error seeding data:", error);
        process.exit(1);
    }
}

seedData();
