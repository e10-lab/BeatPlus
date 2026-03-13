/**
 * 숫자를 지정된 소수점 자리수까지 포맷팅합니다.
 * @param val 포맷팅할 숫자 (undefined 또는 null 가능)
 * @param decimals 소수점 자리수 (기본값: 1)
 * @returns 포맷팅된 문자열 (데이터가 없을 경우 "-")
 */
export function formatNum(val: number | undefined | null | string, decimals = 1): string {
    const num = (typeof val === 'string') ? parseFloat(val) : val;
    if (num === undefined || num === null || isNaN(num)) return "-";
    
    // 1. toFixed()는 IEEE 754 부동소수점 오차가 있더라도 브라우저 내장 로직으로 
    // 가장 표준적인 반올림(Rounding)을 수행하여 문자열을 반환함
    const fixedStr = num.toFixed(decimals);
    
    // 2. 소수점을 기준으로 분리하여 정수 부분에만 천단위 콤마 추가
    const parts = fixedStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    
    // 3. 다시 합쳐서 반환 (toLocaleString의 불확실한 반올림 동작 배제)
    return parts.join('.');
}
