/**
 * CSV 생성 및 다운로드를 위한 유틸리티입니다.
 */

/**
 * 데이터를 CSV 형식으로 변환하고 파일을 다운로드합니다.
 * @param headers CSV 헤더 배열
 * @param rows CSV 데이터 행 배열 (각 행은 문자열 배열)
 * @param filename 저장할 파일 이름
 */
export function downloadCsv(headers: string[], rows: (string | number)[][], filename: string) {
    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell =>
            typeof cell === 'string' && (cell.includes(',') || cell.includes('\n'))
                ? `"${cell.replace(/"/g, '""')}"`
                : cell
        ).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
