
import { DIN_18599_PROFILES } from '../src/lib/din-18599-profiles';

const EXPECTED_2025_VALUES: Record<string, number> = {
    "1_office": 750,
    "2_group_office": 750,
    "3_open_plan": 750,
    "4_meeting": 750,
    "8_classroom": 500,
    "9_lecture_hall": 750,
    "14_kitchen": 750,
    "17_other_common": 500,
    "21_data_center": 750,
    "24_industrial_light": 750,
    "27_stage": 1000,
    "30_library_reading": 750,
    "31_library_open_access": 500
};

console.log("Verifying 2025 Illuminance Values...");
let errors = 0;

for (const [key, expected] of Object.entries(EXPECTED_2025_VALUES)) {
    const profile = DIN_18599_PROFILES[key as keyof typeof DIN_18599_PROFILES];
    if (!profile) {
        console.error(`❌ Profile ${key} not found!`);
        errors++;
        continue;
    }

    if (profile.illuminance !== expected) {
        console.error(`❌ Profile ${key}: Expected ${expected}, Got ${profile.illuminance}`);
        errors++;
    } else {
        console.log(`✅ Profile ${key}: ${profile.illuminance} lx matches.`);
    }
}

if (errors === 0) {
    console.log("🎉 All Checked Profiles Verified Successfully!");
    process.exit(0);
} else {
    console.error(`Found ${errors} errors.`);
    process.exit(1);
}
