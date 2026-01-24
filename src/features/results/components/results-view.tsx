"use client";

import { useEffect, useState } from "react";
import { ZoneInput, CalculationResults } from "@/engine/types";
import { calculateEnergyDemand } from "@/engine/calculator";
import { getProject } from "@/services/project-service";
import { getZones } from "@/services/zone-service";
import { getSurfaces } from "@/services/surface-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Zone } from "@/types/project";
import { MonthlyDemandChart } from "./monthly-demand-chart";
import { EnergyBalanceChart } from "./energy-balance-chart";

interface ResultsViewProps {
    projectId: string;
    isActive?: boolean; // If true, trigger data reload
}

export function ResultsView({ projectId, isActive = true }: ResultsViewProps) {
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<CalculationResults | null>(null);

    useEffect(() => {
        if (!isActive) return; // Skip if not active tab

        const loadDataAndCalculate = async () => {
            setLoading(true);
            try {
                // 1. Fetch Project for Weather Station
                const project = await getProject(projectId);

                // 2. Fetch Zones
                const zones = await getZones(projectId);

                // 3. Fetch Surfaces for each Zone and build ZoneInput
                const zoneInputs: ZoneInput[] = await Promise.all(
                    zones.map(async (zone: Zone) => {
                        const surfaces = await getSurfaces(projectId, zone.id!);
                        return {
                            ...zone,
                            projectId: projectId,
                            surfaces: surfaces
                        } as ZoneInput;
                    })
                );

                // 4. Run Calculation
                const calcResults = calculateEnergyDemand(
                    zoneInputs,
                    project?.weatherStationId,
                    project?.mainStructure,
                    project?.ventilationConfig,
                    project?.ventilationUnits // Pass detailed units for zone-specific lookup
                );
                setResults(calcResults);

            } catch (error) {
                console.error("Calculation failed:", error);
            } finally {
                setLoading(false);
            }
        };

        loadDataAndCalculate();
    }, [projectId, isActive]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2">계산 중...</span>
            </div>
        );
    }

    if (!results) {
        return <div>결과를 불러올 수 없습니다.</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">단위 난방 소요량</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {results.yearly.specificHeatingDemand.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kWh/m²a</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">총 난방 소요량</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {results.yearly.heatingDemand.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">kWh/a</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">연면적</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {results.yearly.totalArea.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">m²</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Warnings Alert */}
            {results.monthly.some(m => m.warnings && m.warnings.length > 0) && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">환기량 부족 알림</h3>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>다음 존에서 필요한 환기량을 충족하지 못하고 있습니다. (창문 또는 공조 설비 확인 필요)</p>
                                <ul className="list-disc pl-5 mt-1 space-y-1">
                                    {Array.from(new Set(results.monthly.flatMap(m => m.warnings || []))).map((w, i) => (
                                        <li key={i}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 차트 영역 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MonthlyDemandChart data={results.monthly} />
                <EnergyBalanceChart data={results.monthly} />
            </div>

            {/* 월별 데이터 테이블 */}
            <Card>
                <CardHeader>
                    <CardTitle>월별 데이터 상세</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                <tr>
                                    <th className="px-4 py-2">월</th>
                                    <th className="px-4 py-2">외기온도 (°C)</th>
                                    <th className="px-4 py-2">손실합계 (kWh)</th>
                                    <th className="px-4 py-2">획득합계 (kWh)</th>
                                    <th className="px-4 py-2">난방요구량 (kWh)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.monthly.map((m) => (
                                    <tr key={m.month} className="border-b">
                                        <td className="px-4 py-2 font-medium">{m.month}월</td>
                                        <td className="px-4 py-2">-</td>
                                        <td className="px-4 py-2 text-red-500">{m.Qloss.toFixed(0)}</td>
                                        <td className="px-4 py-2 text-blue-500">{m.Qgain.toFixed(0)}</td>
                                        <td className="px-4 py-2 font-bold">{m.Qh.toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
