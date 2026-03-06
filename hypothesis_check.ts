
// hypothesis_check.ts
// npx ts-node hypothesis_check.ts

const H_tr = 41.2;
const Ti = 18.47;
const Te = -3.94;
const DeltaT = Ti - Te; // 22.41
const DaysInMonth = 31;
const AnnualDays = 250;

// Method A: App Logic (52 Weeks = 364 Days)
const frac_op_364 = AnnualDays / 364;
const Days_364 = DaysInMonth * frac_op_364;
const QT_364 = (H_tr * DeltaT * Days_364 * 24) / 1000;

// Method B: Standard Logic (365 Days)
const frac_op_365 = AnnualDays / 365;
const Days_365 = DaysInMonth * frac_op_365;
const QT_365 = (H_tr * DeltaT * Days_365 * 24) / 1000;

// Method C: Exact Displayed Days
const Days_Display = 21.3;
const QT_Display = (H_tr * DeltaT * Days_Display * 24) / 1000;

// Targets
const Target_App = 471.99;
const Target_Manual = 471.44;

console.log("--- Hypothesis Check ---");
console.log(`AnnualDays: ${AnnualDays}, DaysInMonth: ${DaysInMonth}`);
console.log("\n1. App Logic (Year=364d):");
console.log(`   Fraction: ${frac_op_364.toFixed(6)}`);
console.log(`   Days: ${Days_364.toFixed(4)}`);
console.log(`   QT: ${QT_364.toFixed(4)}`);
console.log(`   Delta to App Target: ${QT_364 - Target_App}`);

console.log("\n2. Standard Logic (Year=365d):");
console.log(`   Fraction: ${frac_op_365.toFixed(6)}`);
console.log(`   Days: ${Days_365.toFixed(4)}`);
console.log(`   QT: ${QT_365.toFixed(4)}`);
console.log(`   Delta to Manual Target: ${QT_365 - Target_Manual}`);

console.log("\n3. Displayed Days (21.3):");
console.log(`   Days: ${Days_Display}`);
console.log(`   QT: ${QT_Display.toFixed(4)}`);
console.log(`   Delta to App Target: ${QT_Display - Target_App}`);

console.log("\n--- Reverse Engineer Manual Days ---");
// QT = K * Days
// Days = QT / K
const K = (H_tr * DeltaT * 24) / 1000;
const Days_Manual_Exact = Target_Manual / K;
console.log(`Required Days for Manual Target: ${Days_Manual_Exact.toFixed(5)}`);
console.log(`Ratio Manual/31: ${Days_Manual_Exact / 31}`);
console.log(`Implied Annual Days (if /365): ${(Days_Manual_Exact / 31) * 365}`);
console.log(`Implied Annual Days (if /364): ${(Days_Manual_Exact / 31) * 364}`);

