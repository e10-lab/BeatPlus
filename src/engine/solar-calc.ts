/**
 * 경사면의 시간당 입사 일사량 계산
 * Liu & Jordan의 등방성 하늘 모델(Isotropic Sky Model) 기반
 */
export function calculateHourlyRadiation(
    I_beam_h: number, // 수평면 시간당 직달 일사량 [W/m²]
    I_diff_h: number, // 수평면 시간당 확산 일사량 [W/m²]
    dayOfYear: number, // 연중 날짜 (1-365)
    hour: number, // 지방시 (0-23)
    latitude: number, // 위도 (Decimal Degrees)
    surfaceAzimuth: number, // 표면 방위각 (남측=0, 동측=-90, 서측=90, 북측=180)
    surfaceTilt: number // 표면 경사각 (수평=0, 수직=90)
): number {
    if (I_beam_h <= 0 && I_diff_h <= 0) return 0;

    const DEG2RAD = Math.PI / 180.0;
    const latRad = latitude * DEG2RAD;
    const tiltRad = surfaceTilt * DEG2RAD;
    const surfAzRad = surfaceAzimuth * DEG2RAD;
    const groundReflectance = 0.2; // 지면 반사율 (기본값 0.2)

    // 1. 태양 위치 계산
    // 태양 적위 (Declination, delta)
    const delta = 23.45 * Math.sin(DEG2RAD * (360 * (284 + dayOfYear) / 365));
    const decRad = delta * DEG2RAD;

    // 시각각 (Hour Angle, omega)
    // 12:00 정남향을 0도로 기준하여 1시간당 15도씩 변함
    const omega = (hour - 12) * 15;
    const omegaRad = omega * DEG2RAD;

    // 천정각 (Zenith Angle, theta_z) 코사인 값
    // cos(theta_z) = sin(lat)sin(dec) + cos(lat)cos(dec)cos(omega)
    const cosThetaZ = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(omegaRad);

    // 태양 고도각 (Sun Altitude, alpha_s)
    const sunAltitude = Math.asin(Math.max(-1, Math.min(1, cosThetaZ))) * (180 / Math.PI);

    // 태양이 지평선 아래에 있으면 일사량은 0
    if (sunAltitude <= 0) return 0;

    // 태양 방위각 (Solar Azimuth, gamma_s)
    const cosGammaS = (Math.sin(sunAltitude * DEG2RAD) * Math.sin(latRad) - Math.sin(decRad)) /
        (Math.cos(sunAltitude * DEG2RAD) * Math.cos(latRad));

    // 오전/오후 시간에 따른 방위각 부호 결정
    let gammaS_rad = Math.acos(Math.max(-1, Math.min(1, cosGammaS)));
    if (hour < 12) gammaS_rad = -gammaS_rad;

    // 표면 입사각 (Angle of Incidence, theta)
    // cos(theta) = cos(theta_z)cos(beta) + sin(theta_z)sin(beta)cos(gamma_s - gamma_surf)
    const cosTheta = cosThetaZ * Math.cos(tiltRad) +
        Math.sin(Math.acos(Math.max(-1, Math.min(1, cosThetaZ)))) * Math.sin(tiltRad) * Math.cos(gammaS_rad - surfAzRad);

    // 2. 경사면 직달 일사량 (Beam Radiation on Tilted Surface)
    // Rb = cos(theta) / cos(theta_z)
    // 지평선 근처에서 Rb 값이 과도하게 커지는 것을 방지하기 위해 cosThetaZ 하한 설정
    let I_beam_t = 0;
    if (cosThetaZ > 0.05 && cosTheta > 0) {
        const Rb = cosTheta / cosThetaZ;
        I_beam_t = I_beam_h * Rb;
    }

    // 3. 경사면 확산 일사량 (Diffuse Radiation, Isotropic Model)
    // I_diff_t = I_diff_h * (1 + cos(beta))/2
    const I_diff_t = I_diff_h * (1 + Math.cos(tiltRad)) / 2;

    // 4. 지면 반사 일사량 (Reflected Radiation)
    // I_ref_t = (I_beam_h + I_diff_h) * rho * (1 - cos(beta))/2
    const I_ref_t = (I_beam_h + I_diff_h) * groundReflectance * (1 - Math.cos(tiltRad)) / 2;

    return Math.max(0, I_beam_t + I_diff_t + I_ref_t);
}

/**
 * 특정 시점의 태양 고도 및 방위각을 계산합니다.
 */
export function calculateSunPosition(
    dayOfYear: number,
    hour: number,
    latitude: number
): { altitude: number, azimuth: number } {
    const DEG2RAD = Math.PI / 180.0;
    const latRad = latitude * DEG2RAD;

    // 적위 계산
    const delta = 23.45 * Math.sin(DEG2RAD * (360 * (284 + dayOfYear) / 365));
    const decRad = delta * DEG2RAD;

    // 시각각 계산
    const omega = (hour - 12) * 15;
    const omegaRad = omega * DEG2RAD;

    // 천정각 코사인
    const cosThetaZ = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(omegaRad);

    // 고도각 (Degrees)
    const sunAltitude = Math.asin(Math.max(-1, Math.min(1, cosThetaZ))) * (180 / Math.PI);

    let sunAzimuth = 0;
    if (sunAltitude > 0) {
        const cosGammaS = (Math.sin(sunAltitude * DEG2RAD) * Math.sin(latRad) - Math.sin(decRad)) /
            (Math.cos(sunAltitude * DEG2RAD) * Math.cos(latRad));
        let gammaS_rad = Math.acos(Math.max(-1, Math.min(1, cosGammaS)));
        if (hour < 12) gammaS_rad = -gammaS_rad;
        sunAzimuth = gammaS_rad * (180 / Math.PI); // -180 ~ 180 (남측=0)
    }

    return { altitude: sunAltitude, azimuth: sunAzimuth };
}
