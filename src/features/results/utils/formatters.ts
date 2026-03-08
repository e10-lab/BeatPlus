/**
 * 숫자를 지정된 소수점 자리수까지 포맷팅합니다.
 * @param val 포맷팅할 숫자 (undefined 또는 null 가능)
 * @param decimals 소수점 자리수 (기본값: 1)
 * @returns 포맷팅된 문자열 (데이터가 없을 경우 "-")
 */
export function formatNum(val: number | undefined | null, decimals = 1): string {
    if (val === undefined || val === null) return "-";
    return val.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}
