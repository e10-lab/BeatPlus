
"use client";

import React from "react";

import { MonthlyResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zone } from "@/types/project";
import { EffectiveTemperatureVerification } from "./effective-temperature-verification";
import { HeatBalanceVerification } from "./heat-balance-verification";
import { EnergyDemandVerification } from "./energy-demand-verification";
import { IterativeLogsVerification } from "./iterative-logs-verification";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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



                        {/* --- 열전달계수 (Heat Transfer Coefficients) --- */}
                        <TabsContent value="heat_transfer">
                            <div className="space-y-6">
                                {/* 1. Transmission Summary */}
                                <div className="rounded-md border p-4">
                                    <h3 className="font-bold mb-2 text-orange-700">1. 관류 열전달계수 상세 (Transmission H_tr Breakdown)</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        * 외피 유형별/방위별 열전달계수 산정 근거 (고정값 기준)
                                    </p>
                                    <Table className="text-xs">
                                        <TableHeader>
                                            <TableRow className="bg-orange-50/50">
                                                <TableHead className="w-[150px]">부위 (Surface)</TableHead>
                                                <TableHead className="text-right">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">면적<br />A (m²)</span></TooltipTrigger>
                                                        <TooltipContent className="max-w-sm p-3">
                                                            <p className="font-semibold mb-1">A — 순면적 (Nettofläche)</p>
                                                            <p className="text-xs text-muted-foreground">A<sub>net</sub> = A<sub>gross</sub> − A<sub>window</sub></p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">열관류율<br />U (W/m²K)</span></TooltipTrigger>
                                                        <TooltipContent className="max-w-sm p-3">
                                                            <p className="font-semibold mb-1">U — 열관류율 (Wärmedurchgangskoeffizient)</p>
                                                            <p className="text-xs text-muted-foreground">부위별 열관류율 [W/(m²·K)]</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">보정계수<br />f<sub>x</sub> (-)</span></TooltipTrigger>
                                                        <TooltipContent className="max-w-sm p-3">
                                                            <p className="font-semibold mb-1">f<sub>x</sub> — 온도보정계수 (Temperaturkorrekturfaktor)</p>
                                                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                                                <p>외기 접면: f<sub>x</sub> = 1.0</p>
                                                                <p>지반/비난방: f<sub>x</sub> &lt; 1.0</p>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">ΔU<sub>WB</sub><br />(W/m²K)</span></TooltipTrigger>
                                                        <TooltipContent className="max-w-sm p-3">
                                                            <p className="font-semibold mb-1">ΔU<sub>WB</sub> — 열교 보정값 (Wärmebrückenzuschlag)</p>
                                                            <p className="text-xs text-muted-foreground">선형 열교에 의한 추가 열관류율 [W/(m²·K)]</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">H<sub>surf</sub><br />(W/K)</span></TooltipTrigger>
                                                        <TooltipContent className="max-w-sm p-3">
                                                            <p className="font-semibold mb-1">H<sub>surf</sub> — 부위 열전달계수</p>
                                                            <p className="text-xs text-muted-foreground">H<sub>surf</sub> = A · U · f<sub>x</sub></p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">H<sub>bridge</sub><br />(W/K)</span></TooltipTrigger>
                                                        <TooltipContent className="max-w-sm p-3">
                                                            <p className="font-semibold mb-1">H<sub>bridge</sub> — 열교 열전달계수</p>
                                                            <p className="text-xs text-muted-foreground">H<sub>bridge</sub> = A · ΔU<sub>WB</sub> · f<sub>x</sub></p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableHead>
                                                <TableHead className="text-right font-bold border-l">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">H<sub>tr</sub><br />(W/K)</span></TooltipTrigger>
                                                        <TooltipContent className="max-w-sm p-3">
                                                            <p className="font-semibold mb-1">H<sub>tr</sub> — 부위별 총 관류 열전달계수</p>
                                                            <p className="text-xs text-muted-foreground">H<sub>tr</sub> = H<sub>surf</sub> + H<sub>bridge</sub></p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {data[0]?.transmissionBySurface && Object.entries(data[0].transmissionBySurface).map(([key, surf]) => (
                                                <TableRow key={key}>
                                                    <TableCell className="font-medium bg-slate-50/50">{surf.name}</TableCell>
                                                    <TableCell className="text-right">{surf.area.toFixed(1)}</TableCell>
                                                    <TableCell className="text-right">{surf.uValue.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">{surf.fx.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">{surf.delta_U_WB?.toFixed(3) ?? "-"}</TableCell>
                                                    <TableCell className="text-right">{surf.H_tr.toFixed(1)}</TableCell>
                                                    <TableCell className="text-right">{surf.H_bridge.toFixed(1)}</TableCell>
                                                    <TableCell className="text-right font-bold border-l bg-orange-50/20">{(surf.H_tr + surf.H_bridge).toFixed(1)}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="bg-orange-100/50 font-bold border-t-2">
                                                <TableCell>Total</TableCell>
                                                <TableCell className="text-right">{data[0]?.transmissionBySurface ? Object.values(data[0].transmissionBySurface).reduce((a, b) => a + b.area, 0).toFixed(1) : "-"}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">-</TableCell>
                                                <TableCell className="text-right text-muted-foreground">-</TableCell>
                                                <TableCell className="text-right text-muted-foreground">-</TableCell>
                                                <TableCell className="text-right">{data[0]?.transmissionBySurface ? Object.values(data[0].transmissionBySurface).reduce((a, b) => a + b.H_tr, 0).toFixed(1) : "-"}</TableCell>
                                                <TableCell className="text-right">{data[0]?.transmissionBySurface ? Object.values(data[0].transmissionBySurface).reduce((a, b) => a + b.H_bridge, 0).toFixed(1) : "-"}</TableCell>
                                                <TableCell className="text-right border-l text-orange-900">
                                                    {data[0]?.transmissionBySurface
                                                        ? Object.values(data[0].transmissionBySurface).reduce((a, b) => a + (b.H_tr + b.H_bridge), 0).toFixed(1)
                                                        : (data[0]?.H_tr_total?.toFixed(1) ?? "-")
                                                    }
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* 2. Ventilation Summary */}
                                <div className="rounded-md border p-4">
                                    <h3 className="font-bold mb-2 text-green-700">2. 환기 열전달계수 상세 (Ventilation H_ve Breakdown)</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        * 난방/냉방 모드별 열전달계수 및 주요 인자 (연간 평균값)
                                    </p>
                                    {/* Unified Ventilation Breakdown Table */}
                                    <div className="space-y-8">
                                        {(() => {
                                            if (!data || data.length === 0) return null;

                                            // Helper to get averages for specific months (using numbers to match MonthlyResult type)
                                            const heatingMonthNumbers = [1, 2, 3, 4, 5, 10, 11, 12];
                                            const coolingMonthNumbers = [6, 7, 8, 9];
                                            const hData = data.filter(d => heatingMonthNumbers.includes(d.month));
                                            const cData = data.filter(d => coolingMonthNumbers.includes(d.month));

                                            const getAvg = (arr: any[], key: string) =>
                                                arr.length > 0 ? arr.reduce((sum, d) => sum + (d[key] || 0), 0) / arr.length : 0;

                                            return (
                                                <div className="grid grid-cols-1 gap-10">
                                                    {/* 2.0. 공통 기본 입력값 */}
                                                    <div className="space-y-3">
                                                        <h3 className="font-bold text-sm text-green-700 flex items-center gap-2">
                                                            2.0 공통 기본 입력값 (Common Zone Input Parameters)
                                                        </h3>
                                                        <Table className="text-xs border">
                                                            <TableHeader>
                                                                <TableRow className="bg-gray-50/80">
                                                                    <TableHead className="w-[110px]">구분 (Mode)</TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">A<sub>NGF</sub><br />(m²)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">A<sub>NGF</sub> — 순 바닥 면적 (Nettogrundfläche)</p><p className="text-xs text-muted-foreground">존 바닥 면적 [m²]</p></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">h<sub>R</sub><br />(m)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">h<sub>R</sub> — 실 순 높이 (Nettoraumhöhe)</p><p className="text-xs text-muted-foreground">순 실내 높이 [m]</p></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">V<br />(m³)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">V — 존 순 체적 (Nettovolumen)</p><p className="text-xs text-muted-foreground">V = A<sub>NGF</sub> · h<sub>R</sub> · 0.95</p></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">V̇<sub>A</sub><br />(m³/hm²)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">V̇<sub>A</sub> — 면적당 최소 외기 도입량 [식 91]</p><div className="text-xs text-muted-foreground mt-1 space-y-0.5"><p>사용 프로필 기준 위생적 최소 외기량</p><div className="flex items-center gap-1"><span>n<sub>nutz</sub> = </span><span className="inline-flex flex-col items-center"><span className="border-b border-foreground/50 px-1">V̇<sub>A</sub> · A<sub>NGF</sub></span><span className="px-1">V</span></span></div></div></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">n<sub>nutz</sub><br />(1/h)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">n<sub>nutz</sub> — 필요 환기 횟수 [식 91]</p><div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><span>n<sub>nutz</sub> = </span><span className="inline-flex flex-col items-center"><span className="border-b border-foreground/50 px-1">V̇<sub>A</sub> · A<sub>NGF</sub></span><span className="px-1">V</span></span></div></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">n<sub>50</sub><br />(1/h)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">n<sub>50</sub> — 50Pa 압력차 환기 횟수</p><p className="text-xs text-muted-foreground">Blower Door Test 측정값</p></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">f<sub>ATD</sub><br />(-)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">f<sub>ATD</sub> — 외기 도입 장치 보정 계수 [식 68/69]</p><div className="text-xs text-muted-foreground mt-2 space-y-1"><p>ATD 없음: f<sub>ATD</sub> = 1.0</p><div className="flex items-center gap-1"><span>ATD 있음: f<sub>ATD</sub> = min(16, </span><span className="inline-flex flex-col items-center"><span className="border-b border-foreground/50 px-1">n<sub>50</sub> + 1.5</span><span className="px-1">n<sub>50</sub></span></span><span>)</span></div></div></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">n<sub>SUP</sub><br />(1/h)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">n<sub>SUP</sub> — 급기 환기 횟수 [식 97/110]</p><div className="text-xs text-muted-foreground mt-1 space-y-1"><div className="flex items-center gap-1"><span>n<sub>SUP</sub> = </span><span className="inline-flex flex-col items-center"><span className="border-b border-foreground/50 px-1">V̇<sub>SUP</sub></span><span className="px-1">V</span></span></div><p className="text-muted-foreground/70">V̇<sub>SUP</sub> = 기계 급기 체적유량 [m³/h]</p></div></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">n<sub>ETA</sub><br />(1/h)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">n<sub>ETA</sub> — 배기 환기 횟수 [식 99/112]</p><div className="text-xs text-muted-foreground mt-1 space-y-1"><div className="flex items-center gap-1"><span>n<sub>ETA</sub> = </span><span className="inline-flex flex-col items-center"><span className="border-b border-foreground/50 px-1">V̇<sub>ETA</sub></span><span className="px-1">V</span></span></div><p className="text-muted-foreground/70">V̇<sub>ETA</sub> = 기계 배기 체적유량 [m³/h]</p></div></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">η<sub>rec</sub><br />(%)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">η<sub>rec</sub> — 열회수 효율</p><p className="text-xs text-muted-foreground">폐열회수 장치 열회수 비율 [%]</p></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">t<sub>V,m</sub><br />(h/d)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">t<sub>V,mech</sub> — 기계환기 일일 운전 시간</p><p className="text-xs text-muted-foreground">일일 기계환기 가동 시간 [h/d]</p></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                    <TableHead className="text-right">
                                                                        <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">t<sub>nutz</sub><br />(h/d)</span></TooltipTrigger>
                                                                            <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">t<sub>nutz</sub> — 공간 사용 시간</p><p className="text-xs text-muted-foreground">일일 공간 사용 시간 (Nutzungszeit) [h/d]</p></TooltipContent></Tooltip>
                                                                    </TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                <TableRow className="hover:bg-gray-50/10">
                                                                    <TableCell>난방 (Heating Avg)</TableCell>
                                                                    <TableCell className="text-right">{(hData[0]?.A_NGF ?? 0).toFixed(1)}</TableCell>
                                                                    <TableCell className="text-right">{(hData[0]?.roomHeight ?? 0).toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{(hData[0]?.V_net ?? 0).toFixed(1)}</TableCell>
                                                                    <TableCell className="text-right">{(hData[0]?.min_outdoor_airflow ?? 0).toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{getAvg(hData, 'n_nutz').toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{getAvg(hData, 'n50').toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{getAvg(hData, 'f_ATD').toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{getAvg(hData, 'n_SUP').toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{getAvg(hData, 'n_ETA').toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{(getAvg(hData, 'heatRecoveryEff') * 100).toFixed(0)}%</TableCell>
                                                                    <TableCell className="text-right">{getAvg(hData, 't_v_mech').toFixed(1)}</TableCell>
                                                                    <TableCell className="text-right">{(hData[0]?.t_nutz ?? 0).toFixed(1)}</TableCell>
                                                                </TableRow>
                                                                <TableRow className="hover:bg-gray-50/10">
                                                                    <TableCell>냉방 (Cooling Avg)</TableCell>
                                                                    <TableCell className="text-right">{(cData[0]?.A_NGF ?? 0).toFixed(1)}</TableCell>
                                                                    <TableCell className="text-right">{(cData[0]?.roomHeight ?? 0).toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{(cData[0]?.V_net ?? 0).toFixed(1)}</TableCell>
                                                                    <TableCell className="text-right">{(cData[0]?.min_outdoor_airflow ?? 0).toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{getAvg(cData, 'n_nutz').toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{getAvg(cData, 'n50').toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{getAvg(cData, 'f_ATD').toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{getAvg(cData, 'n_SUP').toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{getAvg(cData, 'n_ETA').toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">{(getAvg(cData, 'heatRecoveryEff') * 100).toFixed(0)}%</TableCell>
                                                                    <TableCell className="text-right">{getAvg(cData, 't_v_mech').toFixed(1)}</TableCell>
                                                                    <TableCell className="text-right">{(cData[0]?.t_nutz ?? 0).toFixed(1)}</TableCell>
                                                                </TableRow>
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                    {/* 2.1~2.3 통합: 침기/창문환기/기계환기 산정 상세 */}
                                                    <div className="space-y-3">
                                                        <h3 className="font-bold text-sm text-green-700 flex items-center gap-2">
                                                            2.1~2.3 환기 산정 통합 상세 (Infiltration / Window / Mechanical Ventilation)
                                                        </h3>
                                                        <div className="overflow-x-auto">
                                                            <Table className="text-xs border">
                                                                <TableHeader>
                                                                    {/* Group header row */}
                                                                    <TableRow className="bg-green-50/50">
                                                                        <TableHead rowSpan={2} className="w-[100px] align-bottom">구분 (Mode)</TableHead>
                                                                        <TableHead className="text-center border-l bg-amber-50/30" colSpan={4}>2.1 침기 (Infiltration)</TableHead>
                                                                        <TableHead className="text-center border-l bg-sky-50/30" colSpan={5}>2.2 창문환기 (Window Ventilation)</TableHead>
                                                                        <TableHead className="text-center border-l bg-violet-50/30" colSpan={2}>2.3 기계환기 (Mechanical)</TableHead>

                                                                        <TableHead rowSpan={2} className="text-right font-bold text-blue-700 bg-blue-50/20 align-bottom">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">H<sub>ve,τ</sub><br />(W/K)</span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">H<sub>ve,τ</sub> — 시간상수용 환기 열전달계수</p><div className="text-xs text-muted-foreground mt-1 space-y-1"><p>난방: H<sub>ve,τ</sub> = H<sub>ve</sub> (보정 없음)</p><p>냉방: H<sub>ve,τ</sub> = ρc<sub>p</sub> · V · (n<sub>inf</sub> + n<sub>win,τ</sub> + n<sub>mech,τ</sub>)</p><p className="text-muted-foreground/70">n<sub>win,τ</sub>: 계절보정 전 창문환기</p><p className="text-muted-foreground/70">n<sub>mech,τ</sub>: 열회수 제외 기계환기</p></div></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                    </TableRow>
                                                                    {/* Sub-header row */}
                                                                    <TableRow className="bg-green-50/30">
                                                                        {/* 2.1 Infiltration sub-headers */}
                                                                        <TableHead className="text-right border-l bg-amber-50/20">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">e</span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">e — 체적유량계수</p><p className="text-xs text-muted-foreground">기본값 e = 0.07</p></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                        <TableHead className="text-right bg-amber-50/20">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">f</span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">f — 풍압 계수</p><p className="text-xs text-muted-foreground">기본값 f = 15</p></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                        <TableHead className="text-right bg-amber-50/20">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">f<sub>e</sub></span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">f<sub>e</sub> — 급/배기 불균형 보정 계수 [식 72]</p><div className="text-xs text-muted-foreground mt-1 space-y-1"><p>n<sub>SUP</sub> ≥ n<sub>ETA</sub>: f<sub>e</sub> = 1 (균형/과급기)</p><div className="flex flex-col gap-1"><span>n<sub>SUP</sub> &lt; n<sub>ETA</sub>: </span><div className="flex items-center gap-1"><span>f<sub>e</sub> = </span><span className="inline-flex flex-col items-center"><span className="border-b border-foreground/50 px-1">1</span><span className="px-1">1 + (f/e) · ((n<sub>ETA</sub> - n<sub>SUP</sub>) / (n<sub>50</sub> · f<sub>ATD</sub>))²</span></span></div></div></div></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                        <TableHead className="text-right font-bold bg-amber-50/30">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">n<sub>inf</sub></span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">n<sub>inf</sub> — 침기 환기 횟수 [식 66/67]</p><div className="text-xs text-muted-foreground mt-1 space-y-1"><p>기계환기 無: n<sub>inf</sub> = n<sub>50</sub> · e · f<sub>ATD</sub></p><p>기계환기 有: n<sub>inf</sub> = n<sub>50</sub> · e · f<sub>ATD</sub> · f<sub>e</sub></p></div></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                        {/* 2.2 Window sub-headers */}
                                                                        <TableHead className="text-right border-l bg-sky-50/20">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">n<sub>win,min</sub></span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">n<sub>win,min</sub> — 창문 최소 환기</p><div className="text-xs text-muted-foreground mt-1 space-y-0.5"><p>주거: 0.1</p><p>비주거: min(0.1, 0.3/h<sub>R</sub>)</p></div></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                        <TableHead className="text-right bg-sky-50/20">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">Δn<sub>win</sub></span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">Δn<sub>win</sub> — 추가 자연 창문환기 [식 81/82]</p><div className="text-xs text-muted-foreground mt-1 space-y-1"><p>n<sub>nutz</sub> &lt; 1.2:</p><p className="pl-2">max[0; n<sub>nutz</sub> − (n<sub>nutz</sub> − 0.2) · n<sub>inf</sub> − 0.1]</p><p>n<sub>nutz</sub> ≥ 1.2:</p><p className="pl-2">max[0; n<sub>nutz</sub> − n<sub>inf</sub> − 0.1]</p></div></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                        <TableHead className="text-right bg-sky-50/20">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">Δn<sub>win,m,0</sub></span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">Δn<sub>win,mech,0</sub> — 기계환기 시 기본 추가 창문환기 [식 85/86]</p><div className="text-xs text-muted-foreground mt-1 space-y-1"><p>n<sub>nutz</sub> &lt; 1.2:</p><p className="pl-2">max[0; n<sub>nutz</sub> − (n<sub>nutz</sub> − 0.2) · n<sub>inf,0</sub> · f<sub>e</sub> − 0.1]</p><p>n<sub>nutz</sub> ≥ 1.2:</p><p className="pl-2">max[0; n<sub>nutz</sub> − n<sub>inf,0</sub> · f<sub>e</sub> − 0.1]</p></div></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                        <TableHead className="text-right bg-sky-50/20">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">Δn<sub>win,m</sub></span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">Δn<sub>win,mech</sub> — 기계환기 시 최종 추가 창문환기 [식 87-90]</p><div className="text-xs text-muted-foreground mt-1 space-y-1"><p className="font-medium">Fall a: Δn<sub>win,m,0</sub> ≤ n<sub>SUP</sub></p><p className="pl-2">n<sub>ETA</sub> ≤ n<sub>SUP</sub> + n<sub>inf,0</sub>: 0</p><p className="pl-2">그 외: n<sub>ETA</sub> − n<sub>SUP</sub> − n<sub>inf,0</sub></p><p className="font-medium">Fall b: Δn<sub>win,m,0</sub> &gt; n<sub>SUP</sub></p><p className="pl-2">n<sub>ETA</sub> ≤ Δn<sub>win,m,0</sub> + n<sub>inf,0</sub>: Δn<sub>win,m,0</sub> − n<sub>SUP</sub></p><p className="pl-2">그 외: n<sub>ETA</sub> − n<sub>SUP</sub> − n<sub>inf,0</sub></p></div></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                        <TableHead className="text-right font-bold bg-sky-50/30">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">n<sub>win</sub></span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">n<sub>win</sub> — 유효 창문 환기 횟수 [식 83/84]</p><div className="text-xs text-muted-foreground mt-1 space-y-1"><p>t<sub>V,m</sub> ≥ t<sub>nutz</sub>:</p><p className="pl-2">n<sub>win</sub> = n<sub>win,min</sub> + Δn<sub>win,m</sub> · (t<sub>V,m</sub>/24)</p><p>t<sub>V,m</sub> &lt; t<sub>nutz</sub>:</p><p className="pl-2">n<sub>win</sub> = n<sub>win,min</sub> + Δn<sub>win</sub> · ((t<sub>nutz</sub>−t<sub>V,m</sub>)/24) + Δn<sub>win,m</sub> · (t<sub>V,m</sub>/24)</p></div></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                        {/* 2.3 Mechanical sub-headers */}
                                                                        <TableHead className="text-right border-l bg-violet-50/20">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">V̇<sub>A,Geb</sub></span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">V̇<sub>A,Geb</sub> — 건물 최소 외기 도입량</p><div className="text-xs text-muted-foreground mt-1"><p>건축법 기준 건물 전체 최소 외기 도입량 [m³/(h·m²)]</p><p>사용 프로필의 V̇<sub>A</sub> 값과 동일 (기본값)</p></div></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                        <TableHead className="text-right font-bold bg-violet-50/30">
                                                                            <Tooltip><TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">n<sub>mech</sub></span></TooltipTrigger>
                                                                                <TooltipContent className="max-w-sm p-3"><p className="font-semibold mb-1">n<sub>mech</sub> — 유효 기계 환기 횟수</p><div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><span>n<sub>mech</sub> = n<sub>SUP</sub> · (1 − η<sub>rec</sub>) · </span><span className="inline-flex flex-col items-center"><span className="border-b border-foreground/50 px-1">t<sub>V,mech</sub></span><span className="px-1">24</span></span></div></TooltipContent></Tooltip>
                                                                        </TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    <TableRow className="hover:bg-green-50/10">
                                                                        <TableCell className="font-bold text-red-600">난방 (Heating)</TableCell>
                                                                        {/* 2.1 침기 */}
                                                                        <TableCell className="text-right border-l">{getAvg(hData, 'e_shield').toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right">{getAvg(hData, 'f_wind').toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right">{getAvg(hData, 'f_e').toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right font-bold text-amber-700">{getAvg(hData, 'n_inf').toFixed(3)}</TableCell>
                                                                        {/* 2.2 창문환기 */}
                                                                        <TableCell className="text-right border-l">{getAvg(hData, 'n_win_min').toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right">{getAvg(hData, 'Delta_n_win').toFixed(3)}</TableCell>
                                                                        <TableCell className="text-right">{getAvg(hData, 'Delta_n_win_mech_0').toFixed(3)}</TableCell>
                                                                        <TableCell className="text-right">{getAvg(hData, 'Delta_n_win_mech').toFixed(3)}</TableCell>
                                                                        <TableCell className="text-right font-bold text-sky-700">{getAvg(hData, 'n_win').toFixed(3)}</TableCell>
                                                                        {/* 2.3 기계환기 */}
                                                                        <TableCell className="text-right border-l">{(hData[0]?.V_A_Geb ?? 0).toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right font-bold text-violet-700">{getAvg(hData, 'n_mech').toFixed(3)}</TableCell>
                                                                        {/* 결과 */}

                                                                        <TableCell className="text-right font-bold text-blue-700 bg-blue-50/10">{(data.reduce((sum, d) => sum + (d.H_ve_tau_h || 0), 0) / (data.length || 1)).toFixed(1)}</TableCell>
                                                                    </TableRow>
                                                                    <TableRow className="hover:bg-green-50/10">
                                                                        <TableCell className="font-bold text-blue-600">냉방 (Cooling)</TableCell>
                                                                        {/* 2.1 침기 */}
                                                                        <TableCell className="text-right border-l">{getAvg(cData, 'e_shield').toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right">{getAvg(cData, 'f_wind').toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right">{getAvg(cData, 'f_e').toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right font-bold text-amber-700">{getAvg(cData, 'n_inf').toFixed(3)}</TableCell>
                                                                        {/* 2.2 창문환기 */}
                                                                        <TableCell className="text-right border-l">{getAvg(cData, 'n_win_min').toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right">{getAvg(cData, 'Delta_n_win').toFixed(3)}</TableCell>
                                                                        <TableCell className="text-right">{getAvg(cData, 'Delta_n_win_mech_0').toFixed(3)}</TableCell>
                                                                        <TableCell className="text-right">{getAvg(cData, 'Delta_n_win_mech').toFixed(3)}</TableCell>
                                                                        <TableCell className="text-right font-bold text-sky-700">{getAvg(cData, 'n_win').toFixed(3)}</TableCell>
                                                                        {/* 2.3 기계환기 */}
                                                                        <TableCell className="text-right border-l">{(cData[0]?.V_A_Geb ?? 0).toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right font-bold text-violet-700">{getAvg(cData, 'n_mech').toFixed(3)}</TableCell>
                                                                        {/* 결과 */}

                                                                        <TableCell className="text-right font-bold text-blue-700 bg-blue-50/10">{(data.reduce((sum, d) => sum + (d.H_ve_tau_c || 0), 0) / (data.length || 1)).toFixed(1)}</TableCell>
                                                                    </TableRow>
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* --- 유효 온도 (Effective Temperature) --- */}
                        <TabsContent value="temp_verify" className="space-y-6">
                            <EffectiveTemperatureVerification
                                data={data}
                                title={`유효 실내 온도 산정 상세`}
                                zone={zone}
                            />
                        </TabsContent>

                        {/* --- 열수지 검증 (Heat Balance) --- */}
                        <TabsContent value="balance_verify" className="space-y-6">
                            <HeatBalanceVerification
                                data={data}
                                title={`상세 열수지 분석`}
                                zone={zone}
                                selectedMonth={selectedMonth}
                                selectedIterationStep={selectedIterationStep}
                                onMonthChange={handleMonthChange}
                                onIterationSelect={handleIterationSelect}
                            />
                        </TabsContent>

                        <TabsContent value="energy_demand" className="space-y-6">
                            <EnergyDemandVerification
                                data={data}
                                title={`에너지 요구량 상세 검증 - ${zone?.name || "전체"}`}
                                zone={zone}
                                selectedMonth={selectedMonth}
                                selectedIterationStep={selectedIterationStep}
                                onMonthChange={handleMonthChange}
                            />
                        </TabsContent>

                        {/* --- 반복 계산 이력 (Iterative Logs) --- */}
                        <TabsContent value="iteration_logs" className="space-y-6">
                            <IterativeLogsVerification
                                data={data}
                                title="반복 계산 상세 수렴 이력 (Detailed Iteration Logs)"
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
