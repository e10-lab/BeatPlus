
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HeatBalanceVerification } from "@/features/results/components/heat-balance-verification";
import { calculateEnergyDemand } from "@/engine/calculator";
import { getClimateData } from "@/engine/climate-data";
import { ZoneInput, MonthlyResult } from "@/engine/types";
import { Construction } from "@/types/project";
import { Play, ClipboardCheck, Info } from "lucide-react";

export default function VerifyBalancePage() {
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [log, setLog] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<number>(0);
    const [selectedIterationStep, setSelectedIterationStep] = useState<number | null>(null);

    const addLog = (msg: string) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    const runScenario = () => {
        setLoading(true);
        addLog("열수지 균형 시나리오 시작...");

        try {
            // 1. Setup Scenario: Standard Office
            const testZone: ZoneInput = {
                id: "test-zone",
                name: "검증용 사무실 (Test Office)",
                usageType: "1_office",
                area: 100,
                height: 3,
                volume: 300,
                temperatureSetpoints: { heating: 20, cooling: 26 },
                projectId: "verify-project",
                surfaces: [
                    {
                        id: "wall-south",
                        zoneId: "test-zone",
                        name: "남측 외벽",
                        type: "wall_exterior",
                        area: 30,
                        uValue: 0.15,
                        orientation: "S",
                        tilt: 90,
                        constructionId: "wall-standard"
                    },
                    {
                        id: "window-south",
                        zoneId: "test-zone",
                        name: "남측 창호",
                        type: "window",
                        area: 10,
                        uValue: 1.5,
                        shgc: 0.6,
                        orientation: "S",
                        tilt: 90,
                        constructionId: "window-standard"
                    }
                ]
            };

            const mockConstructions: Construction[] = [
                {
                    id: "wall-standard",
                    name: "표준 외벽",
                    type: "wall",
                    layers: [{ materialId: "concrete", thickness: 0.2, conductivity: 1.6 }]
                } as any,
                {
                    id: "window-standard",
                    name: "표준 창호",
                    type: "window",
                    uValue: 1.5,
                    gValue: 0.6
                } as any
            ];

            const weather = getClimateData(); // Seoul Default

            addLog(`입력 데이터 준비 완료: ${testZone.name}`);

            // 2. Run Calculation
            const calcResults = calculateEnergyDemand(
                [testZone],
                weather,
                undefined, // mainStructure
                { type: "natural", n50: 1.5, heatRecoveryEfficiency: 0 } as any,
                undefined,
                { class: "C" } as any,
                [],
                mockConstructions,
                "monthly"
            );

            addLog("계산 엔진 실행 완료.");
            setResults(calcResults);

        } catch (e: any) {
            addLog(`오류 발생: ${e.message}`);
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Auto-run once for immediate feedback
    useEffect(() => {
        runScenario();
    }, []);

    return (
        <div className="container mx-auto py-8 space-y-8 max-w-6xl">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">열손실/열취득 상세 균형 (Heat Balance)</h1>
                    <p className="text-muted-foreground mt-1">
                        ISO 13790 / DIN 18599 기반의 에너지 밸런스 성분별 정밀 분석 페이지입니다.
                    </p>
                </div>
                <Button onClick={runScenario} disabled={loading} className="gap-2">
                    {loading ? <ClipboardCheck className="animate-pulse" /> : <Play size={18} />}
                    새로고침 / 재계산
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left side: Info & Log */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Info size={16} className="text-blue-600" /> 검증 알림
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-4 leading-relaxed text-muted-foreground">
                            <p>
                                이 페이지는 수동 계산(엑셀 등)과의 대조를 위해 <strong>중간 계산 인자들</strong>을 노출합니다.
                            </p>
                            <ul className="list-disc pl-4 space-y-2">
                                <li><strong>H<sub>tr</sub></strong>: 전도 전열계수</li>
                                <li><strong>H<sub>ve</sub></strong>: 환기 전열계수</li>
                                <li><strong>Q<sub>sol</sub></strong>: 방위별 일사 획득</li>
                                <li><strong>Q<sub>int</sub></strong>: 항목별 내부 발열</li>
                            </ul>
                            <div className="p-3 bg-amber-50 rounded border border-amber-100 text-amber-800 font-medium">
                                ※ 실제 프로젝트 결과는 각 프로젝트의 <span className="underline">결과 -&gt; 검증 탭</span>에서도 확인 가능합니다.
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">실행 로그</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-slate-950 text-slate-50 p-3 rounded font-mono text-[10px] h-[200px] overflow-y-auto space-y-1">
                                {log.map((l, i) => <div key={i}>{l}</div>)}
                                {log.length === 0 && <div className="text-slate-500">로그가 없습니다.</div>}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right side: Verification Component */}
                <div className="lg:col-span-3">
                    {results ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <HeatBalanceVerification
                                data={results.zones[0].monthly}
                                title={`검증 데이터: ${results.zones[0].zoneName}`}
                                selectedMonth={selectedMonth}
                                selectedIterationStep={selectedIterationStep}
                                onMonthChange={setSelectedMonth}
                                onIterationSelect={setSelectedIterationStep}
                            />
                        </div>
                    ) : (
                        <Card className="h-[600px] flex items-center justify-center border-dashed">
                            <div className="text-center space-y-4">
                                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                                <p className="text-muted-foreground">데이터 계산 중...</p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
