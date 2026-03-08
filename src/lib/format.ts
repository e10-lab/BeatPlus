/**
 * 숫자 데이터를 포맷팅하는 공통 유틸리티입니다.
 */

/**
 * 숫자를 지정된 소수점 자리수까지 포맷팅 문자열로 변환합니다.
 * @param v 포맷팅할 숫자 (undefined 또는 null 가능)
 * @param decimals 소수점 자리수 (기본값: 1)
 * @returns 포맷팅된 문자열 또는 데이터 없음 표시("-")
 */
export function formatValue(v: number | undefined | null, decimals = 1): string {
    if (v === undefined || v === null || isNaN(v)) return "-";
    return v.toFixed(decimals);
}

/**
 * 숫자를 포맷팅하되 로케일 문자열(콤마 포함)로 변환합니다.
 */
export function formatNumberWithComma(v: number | undefined | null, decimals = 0): string {
    if (v === undefined || v === null || isNaN(v)) return "-";
    return v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}
