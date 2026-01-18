"use client";

import { useEffect, useState } from "react";
import { ZoneInput, CalculationResults } from "@/engine/types";
import { calculateEnergyDemand } from "@/engine/calculator";
import { getZones } from "@/services/zone-service";
import { getSurfaces } from "@/services/surface-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Zone } from "@/types/project";

interface ResultsViewProps {
    projectId: string;
}

export function ResultsView({ projectId }: ResultsViewProps) {
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<CalculationResults | null>(null);

    useEffect(() => {
        const loadDataAndCalculate = async () => {
            setLoading(true);
            try {
                // 1. Fetch Zones
                const zones = await getZones(projectId);

                // 2. Fetch Surfaces for each Zone and build ZoneInput
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

                // 3. Run Calculation
                const calcResults = calculateEnergyDemand(zoneInputs);
                setResults(calcResults);

            } catch (error) {
                console.error("Calculation failed:", error);
            } finally {
                setLoading(false);
            }
        };

        loadDataAndCalculate();
    }, [projectId]);

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

            {/* 월별 차트 (테이블로 대체 for now) */}
            <Card>
                <CardHeader>
                    <CardTitle>월별 에너지 상세</CardTitle>
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
                                        <td className="px-4 py-2">-</td> {/* Temp not currently in MonthlyResult, maybe add it? */}
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
