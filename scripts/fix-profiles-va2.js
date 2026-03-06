/**
 * Script to fix remaining profiles that had different key names
 */

const fs = require('fs');

// Profiles that were missed (with actual keys) 
const FIXES = {
    "1_office": [4, 2.5],
    "3_open_plan": [6, 2.5],
    "4_meeting": [15, 2.5],
    "7_retail_cooling": [4, 2.5],
    "15_kitchen_prep": [15, 0],
    "17_other_common": [7, 2.5],
    "18_ancillary_no_common": [0.15, 0],
    "19_traffic_area": [0, 0],
    "26_theater_foyer": [25, 5.0],
    "28_trade_fair_congress": [7, 2.5],
    "29_exhibition_museum": [2, 2.0],
    "34_parking_private": [8, 0],
    // Profile at line 164: "29_library" is actually profile 5.1 (meeting/large)
    // Need to check what this really is
};

const filePath = '/Users/zero/Documents/GitHub/BeatPlus/src/lib/din-18599-profiles.ts';
let content = fs.readFileSync(filePath, 'utf-8');

for (const [key, [va, vaGeb]] of Object.entries(FIXES)) {
    const profilePattern = `"${key}"`;
    const profileIdx = content.indexOf(profilePattern);
    if (profileIdx === -1) {
        console.log(`WARN: Profile ${key} not found`);
        continue;
    }

    const afterProfile = content.substring(profileIdx);
    const minOutdoorMatch = afterProfile.match(/minOutdoorAir: [\d.-]+,?\s*(?:\/\/.*)?/);
    if (!minOutdoorMatch) {
        console.log(`WARN: No minOutdoorAir found after ${key}`);
        continue;
    }

    const matchIdx = profileIdx + afterProfile.indexOf(minOutdoorMatch[0]);
    const oldLine = minOutdoorMatch[0];

    // Check if minOutdoorAirBuilding already exists nearby
    const nextChunk = content.substring(matchIdx, matchIdx + 200);
    if (nextChunk.includes('minOutdoorAirBuilding')) {
        console.log(`SKIP: ${key} already has minOutdoorAirBuilding`);
        // Still fix the V_A value if needed
        const currentVA = parseFloat(oldLine.match(/minOutdoorAir: ([\d.-]+)/)[1]);
        if (Math.abs(currentVA - va) > 0.001) {
            console.log(`  FIX V_A: ${currentVA} → ${va}`);
            const newLine = oldLine.replace(/minOutdoorAir: [\d.-]+/, `minOutdoorAir: ${va}`);
            content = content.substring(0, matchIdx) + newLine + content.substring(matchIdx + oldLine.length);
        }
        continue;
    }

    // Fix V_A value
    const currentVA = parseFloat(oldLine.match(/minOutdoorAir: ([\d.-]+)/)[1]);
    let newLine = oldLine;
    if (Math.abs(currentVA - va) > 0.001) {
        console.log(`FIX V_A for ${key}: ${currentVA} → ${va}`);
        newLine = oldLine.replace(/minOutdoorAir: [\d.-]+/, `minOutdoorAir: ${va}`);
    }

    // Get indentation
    const lineStart = content.lastIndexOf('\n', matchIdx) + 1;
    const indent = content.substring(lineStart, matchIdx).match(/^\s*/)[0];

    // Add minOutdoorAirBuilding
    const addLine = `\n${indent}minOutdoorAirBuilding: ${vaGeb},`;
    const replacement = newLine.replace(/,?\s*$/, ',') + addLine;

    content = content.substring(0, matchIdx) + replacement + content.substring(matchIdx + oldLine.length);
    console.log(`OK: ${key} V_A=${va}, V_A,Geb=${vaGeb}`);
}

// Also check "29_library" profile at line ~164
const lib29Idx = content.indexOf('"29_library"');
if (lib29Idx !== -1) {
    const afterProfile = content.substring(lib29Idx);
    const minOutdoorMatch = afterProfile.match(/minOutdoorAir: [\d.-]+,?\s*(?:\/\/.*)?/);
    if (minOutdoorMatch) {
        const matchIdx = lib29Idx + afterProfile.indexOf(minOutdoorMatch[0]);
        const nextChunk = content.substring(matchIdx, matchIdx + 200);
        if (!nextChunk.includes('minOutdoorAirBuilding')) {
            const oldLine = minOutdoorMatch[0];
            const lineStart = content.lastIndexOf('\n', matchIdx) + 1;
            const indent = content.substring(lineStart, matchIdx).match(/^\s*/)[0];
            const addLine = `\n${indent}minOutdoorAirBuilding: 2.0,`;
            const replacement = oldLine.replace(/,?\s*$/, ',') + addLine;
            content = content.substring(0, matchIdx) + replacement + content.substring(matchIdx + oldLine.length);
            console.log('OK: 29_library V_A=2, V_A,Geb=2.0');
        }
    }
}

fs.writeFileSync(filePath, content);
console.log('\nDone! Remaining profiles updated.');
