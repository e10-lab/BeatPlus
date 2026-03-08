"use client";

import React from "react";
import { MonthlyResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zone } from "@/types/project";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { HeatTransferVerification } from "./heat-transfer-verification";
import { EffectiveTemperatureVerification } from "./effective-temperature-verification";
import { HeatBalanceVerification } from "./heat-balance-verification";
import { EnergyDemandVerification } from "./energy-demand-verification";
import { IterativeLogsVerification } from "./iterative-logs-verification";

interface VerificationTableProps {
    data: MonthlyResult[];
    title?: string;
    zone?: Zone;
}

export function VerificationTable({ data, title, zone }: VerificationTableProps) {
    const [selectedMonth, setSelectedMonth] = React.useState<number>(data[0]?.month || 1);
    const [selectedIterationStep, setSelectedIterationStep] = React.useState<number | null>(null);

    if (!data || data.length === 0) return <div className="p-4 text-center text-muted-foreground">데이터가 없습니다.</div>;

    const currentMonthDataRaw = data.find((m) => m.month === selectedMonth) || data[0];

    const handleMonthChange = (month: number) => {
        setSelectedMonth(month);
        setSelectedIterationStep(null);
    };

    const handleIterationSelect = (step: number | null) => {
        setSelectedIterationStep(step);
    };

    return (
        <TooltipProvider>
            <Card className="w-full overflow-hidden">
                <CardHeader>
                    <CardTitle>{title || "상세 검증 데이터 (Verification Data)"}</CardTitle>
                    <CardDescription>ISO 13790 / DIN 18599 상세 계산 변수 (사용/비사용 구분 포함)</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-muted/50">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-muted-foreground">조회 월:</span>
                                <Select value={selectedMonth.toString()} onValueChange={(v) => handleMonthChange(parseInt(v))}>
                                    <SelectTrigger className="w-[100px] bg-background font-medium hover:bg-accent/50 transition-colors">
                                        <SelectValue placeholder="월 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data.map(m => (
                                            <SelectItem key={m.month} value={m.month.toString()} className="cursor-pointer">
                                                {m.month}월
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {currentMonthDataRaw.iterationLogs && currentMonthDataRaw.iterationLogs.length > 0 && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 rounded-md border border-purple-100">
                                    <span className="text-[11px] font-bold text-purple-700 whitespace-nowrap">반복 단계:</span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setSelectedIterationStep(null)}
                                            className={cn(
                                                "px-2 py-0.5 text-[10px] rounded border transition-all",
                                                selectedIterationStep === null
                                                    ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                                                    : "bg-white text-purple-600 border-purple-200 hover:border-purple-400"
                                            )}
                                        >
                                            Final
                                        </button>
                                        {currentMonthDataRaw.iterationLogs?.map((log: any) => (
                                            <button
                                                key={log.step}
                                                onClick={() => setSelectedIterationStep(log.step)}
                                                className={cn(
                                                    "px-2 py-0.5 text-[10px] rounded border transition-all",
                                                    selectedIterationStep === log.step
                                                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                                                        : "bg-white text-purple-600 border-purple-200 hover:border-purple-400"
                                                )}
                                            >
                                                Step {log.step}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedIterationStep !== null && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-md border border-amber-200 animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                <span className="text-xs font-bold text-amber-700">
                                    주의: 현재 반복 계산 {selectedIterationStep}단계 데이터를 조회 중입니다. (최종 아님)
                                </span>
                            </div>
                        )}
                    </div>

                    <Tabs defaultValue="heat_transfer" className="w-full">
                        <TabsList className="mb-4 w-full justify-start overflow-x-auto h-auto p-1 bg-muted/50 rounded-lg">
                            <TabsTrigger value="heat_transfer" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all py-2 px-4 text-xs font-medium">열전달계수 (H-Values)</TabsTrigger>
                            <TabsTrigger value="temp_verify" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all py-2 px-4 text-xs font-medium">유효 온도 (Temp)</TabsTrigger>
                            <TabsTrigger value="balance_verify" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all py-2 px-4 text-xs font-medium">열수지 분석 (Heat Balance)</TabsTrigger>
                            <TabsTrigger value="energy_demand" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all py-2 px-4 text-xs font-medium">에너지 요구량 (Demand)</TabsTrigger>
                            <TabsTrigger value="iteration_logs" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all py-2 px-4 text-xs font-medium">반복 계산 (Iteration)</TabsTrigger>
                        </TabsList>

                        <TabsContent value="heat_transfer">
                            <HeatTransferVerification data={data} zone={zone} />
                        </TabsContent>

                        <TabsContent value="temp_verify">
                            <EffectiveTemperatureVerification 
                                data={data} 
                                zone={zone} 
                                selectedMonth={selectedMonth}
                            />
                        </TabsContent>

                        <TabsContent value="balance_verify">
                            <HeatBalanceVerification 
                                data={data} 
                                zone={zone}
                                selectedMonth={selectedMonth}
                                selectedIterationStep={selectedIterationStep}
                                onMonthChange={handleMonthChange}
                                onIterationSelect={handleIterationSelect}
                            />
                        </TabsContent>

                        <TabsContent value="energy_demand">
                            <EnergyDemandVerification 
                                data={data} 
                                zone={zone} 
                                selectedMonth={selectedMonth}
                                selectedIterationStep={selectedIterationStep}
                                onMonthChange={handleMonthChange}
                            />
                        </TabsContent>

                        <TabsContent value="iteration_logs">
                            <IterativeLogsVerification 
                                data={data} 
                                selectedMonth={selectedMonth}
                                onMonthChange={handleMonthChange}
                                selectedIterationStep={selectedIterationStep}
                                onIterationSelect={handleIterationSelect}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
