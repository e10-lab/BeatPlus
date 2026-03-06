"use client";

import React, { useState } from "react";
import { MonthlyResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Zap, ThermometerSnowflake, Flame, Droplets, ChevronDown, ChevronUp, ChevronRight, Layers } from "lucide-react";
import { Zone } from "@/types/project";
import { DIN_18599_PROFILES } from "@/lib/din-18599-profiles";
import { cn } from "@/lib/utils";

interface EnergyDemandVerificationProps {
    data: MonthlyResult[];
    title?: string;
    zone?: Zone;
    selectedMonth: number;
    selectedIterationStep: number | null;
    onMonthChange: (month: number) => void;
}

export function EnergyDemandVerification({
    data,
    title,
    zone,
    selectedMonth,
    selectedIterationStep,
    onMonthChange
}: EnergyDemandVerificationProps) {
    const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({
        step1: true,
        step2: true,
        step3: true,
        step4: true,
        step5: true,
        step6: false,
    });

    const toggleStep = (step: string) => {
        setExpandedSteps(prev => ({ ...prev, [step]: !prev[step] }));
    };

    const toggleAll = (expanded: boolean) => {
        setExpandedSteps({
            step1: expanded,
            step2: expanded,
            step3: expanded,
            step4: expanded,
            step5: expanded,
            step6: expanded,
        });
    };

    if (!data || data.length === 0) return <div className="p-4 text-center text-muted-foreground">데이터가 없습니다.</div>;

    const currentMonthDataRaw = data.find(m => m.month === selectedMonth) || data[0];

    // 반복 단계 세부 성분이 있는 경우 오버라이드 (핵심 로직)
    const selectedLog = selectedIterationStep !== null
        ? currentMonthDataRaw.iterationLogs?.find(L => L.step === selectedIterationStep)
        : null;

    const currentMonthData = selectedLog?.details ? {
        ...currentMonthDataRaw,
        QT_heat: selectedLog.details.QT,
        QV_heat: selectedLog.details.QV,
        QS: selectedLog.details.QS,
        QI: selectedLog.details.QI,
        Q_h_b: selectedLog.details.Q_h_b,
        Q_c_b: selectedLog.details.Q_c_b,
        eta: selectedLog.details.eta_h,
        eta_C: selectedLog.details.eta_c,
        gamma: selectedLog.details.gamma_h,
        gamma_C: selectedLog.details.gamma_c,
        // 이용률 상세 수치도 업데이트 (Metadata 연동이 필요한 경우 여기서 추가 확장 가능하겠으나 현재는 Demand 위주)
    } : currentMonthDataRaw;

    const meta = currentMonthData.energyDemandMetadata;
    const h = meta?.heating;
    const c = meta?.cooling;

    const profile = zone?.usageType ? (DIN_18599_PROFILES[zone.usageType] || DIN_18599_PROFILES["1_office"]) : DIN_18599_PROFILES["1_office"];

    const formatNum = (val: number | undefined, decimals = 1) => val !== undefined ? val.toFixed(decimals) : "-";

    return (
        <TooltipProvider>
            <Card className="w-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                    <div>
                        <CardTitle>{title || "에너지 요구량 상세 검증 (Energy Demand Verification)"}</CardTitle>
                        <CardDescription>DIN/TS 18599-2 기반 유효 에너지 요구량(Nutzenergie) 및 이용률 분석</CardDescription>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-700">조회 월:</span>
                            <Select value={selectedMonth.toString()} onValueChange={(v) => onMonthChange(parseInt(v))}>
                                <SelectTrigger className="w-[100px] bg-white h-8 text-xs">
                                    <SelectValue placeholder="월 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {data.map(m => (
                                        <SelectItem key={m.month} value={m.month.toString()}>{m.month}월</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="h-4 w-px bg-slate-300 mx-1" />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => toggleAll(true)}
                                className="text-[10px] px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                            >
                                모두 펼치기
                            </button>
                            <button
                                onClick={() => toggleAll(false)}
                                className="text-[10px] px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                            >
                                모두 접기
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">

                    {/* 1. 요약 (Step 1) */}
                    <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
                        <button
                            onClick={() => toggleStep('step1')}
                            className={cn(
                                "w-full flex items-center justify-between p-4 transition-colors text-left",
                                expandedSteps.step1 ? "bg-slate-50/80 border-b" : "hover:bg-slate-50"
                            )}
                        >
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <span className="bg-primary/10 text-primary p-1 rounded font-mono text-sm">Step 1</span>
                                에너지 요구량 요약 (Energy Demand Summary)
                            </h3>
                            {expandedSteps.step1 ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                        </button>

                        {expandedSteps.step1 && (
                            <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="p-4 rounded-lg bg-red-50 border border-red-100 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Flame className="h-4 w-4 text-red-500" />
                                                <div className="text-xs text-red-600 font-medium">난방 요구량 (Heating)</div>
                                            </div>
                                            <div className="text-2xl font-bold text-red-700">{formatNum(currentMonthData.Q_h_b)} <span className="text-sm font-normal">kWh/월</span></div>
                                        </div>
                                        <div className="text-[10px] text-red-400 mt-2 font-mono italic flex justify-between items-center">
                                            <InlineMath math="Q_{h,b}" />
                                            <span className="text-[9px] opacity-70">Util: {formatNum(h?.eta, 3)}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <ThermometerSnowflake className="h-4 w-4 text-blue-500" />
                                                <div className="text-xs text-blue-600 font-medium">냉방 요구량 (Cooling)</div>
                                            </div>
                                            <div className="text-2xl font-bold text-blue-700">{formatNum(currentMonthData.Q_c_b)} <span className="text-sm font-normal">kWh/월</span></div>
                                        </div>
                                        <div className="text-[10px] text-blue-400 mt-2 font-mono italic flex justify-between items-center">
                                            <InlineMath math="Q_{c,b}" />
                                            <span className="text-[9px] opacity-70">Util: {formatNum(c?.eta, 3)}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-cyan-50 border border-cyan-100 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Droplets className="h-4 w-4 text-cyan-500" />
                                                <div className="text-xs text-cyan-600 font-medium">급탕 요구량 (DHW)</div>
                                            </div>
                                            <div className="text-2xl font-bold text-cyan-700">{formatNum(currentMonthData.Q_w_b)} <span className="text-sm font-normal">kWh/월</span></div>
                                        </div>
                                        <div className="text-[10px] text-cyan-400 mt-2 font-mono italic">
                                            <InlineMath math="Q_{w,b}" />
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-100 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Zap className="h-4 w-4 text-yellow-500" />
                                                <div className="text-xs text-yellow-600 font-medium">조명 요구량 (Lighting)</div>
                                            </div>
                                            <div className="text-2xl font-bold text-yellow-700">{formatNum(currentMonthData.Q_l_b)} <span className="text-sm font-normal">kWh/월</span></div>
                                        </div>
                                        <div className="text-[10px] text-yellow-500 mt-2 font-mono italic">
                                            <InlineMath math="Q_{l,b}" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <div className="h-px bg-slate-200 my-8" />

                    <div className="grid grid-cols-1 gap-14">
                        {/* 2) 난방 상세 */}
                        <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
                            <button
                                onClick={() => toggleStep('step2')}
                                className={cn(
                                    "w-full flex items-center justify-between p-4 transition-colors text-left",
                                    expandedSteps.step2 ? "bg-red-50/50 border-b border-red-100" : "hover:bg-red-50/30"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="bg-red-100 text-red-700 p-1 rounded font-mono text-sm">Step 2</span>
                                    <h3 className="text-lg font-semibold text-red-700">난방 이용률 및 요구량 산출 (Heating Energy Demand)</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-red-700 font-bold text-sm">{formatNum(currentMonthData.Q_h_b, 1)} kWh/월</div>
                                    {expandedSteps.step2 ? <ChevronDown className="h-5 w-5 text-red-300" /> : <ChevronRight className="h-5 w-5 text-red-300" />}
                                </div>
                            </button>

                            {expandedSteps.step2 && (
                                <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="rounded-md border border-red-100 overflow-hidden bg-white">
                                        <Table className="text-xs">
                                            <TableHeader className="bg-red-50/50">
                                                <TableRow className="hover:bg-transparent border-b-red-100">
                                                    <TableHead className="w-24 text-slate-600">구분 (Item)</TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일수 (<InlineMath math="d" />)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">운전 일수 (<InlineMath math="d" />)</p>
                                                                해당 운전 모드(사용/비사용)의 월간 일수
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="\tau_h" /> (h)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">시상수 (<InlineMath math="\tau_h" />)</p>
                                                                건물의 열적 관성을 나타내는 시간 상수 (시간)
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="a_h" /> (-)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">수치적 매개변수 (<InlineMath math="a_h" />)</p>
                                                                시상수와 유효 열용량에 따른 무차원 매개변수
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="\gamma_h" /> (-)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">열획득/열손실 비 (<InlineMath math="\gamma_h" />)</p>
                                                                태양 및 내부 열획득과 전송 및 환기 열손실의 비율
                                                                <div className="mt-1 text-slate-400">
                                                                    <InlineMath math="\gamma_h = Q_{gain} / Q_{loss}" />
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="Q_{sink}" /> (kWh)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">열싱크 (<InlineMath math="Q_{sink}" />)</p>
                                                                난방의 경우 총 열손실(<InlineMath math="Q_{loss}" />)과 동일
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="Q_{source}" /> (kWh)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">열소스 (<InlineMath math="Q_{source}" />)</p>
                                                                난방의 경우 총 열획득(<InlineMath math="Q_{gain}" />)과 동일
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="\eta_h" /> (-)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">이용계수 (<InlineMath math="\eta_h" />)</p>
                                                                열획득이 난방 부하 감소에 기여하는 비율
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right font-bold text-red-700 bg-red-50/50">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="Q_{h,b}" /> (kWh)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">난방 요구량 (<InlineMath math="Q_{h,b}" />)</p>
                                                                최종적으로 필요한 난방 에너지
                                                                <div className="mt-1 text-slate-400">
                                                                    <InlineMath math="Q_{h,b} = Q_{sink} - \eta_h \cdot Q_{source}" />
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow className="hover:bg-slate-50 border-b border-red-50/50">
                                                    <TableCell className="font-medium flex items-center gap-1.5"><Zap className="h-3 w-3 text-red-400" />사용일 (Usage)</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-600">{formatNum(currentMonthData.d_nutz, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.tau_op, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.alpha_op, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.Q_sink_op && currentMonthData.Q_sink_op > 0 ? (currentMonthData.Q_source_op || 0) / currentMonthData.Q_sink_op : 0, 3)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNum(currentMonthData.Q_sink_op, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-orange-600/80">{formatNum(currentMonthData.Q_source_op, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.eta_h_op, 4)}</TableCell>
                                                    <TableCell className="text-right font-mono font-medium text-red-600/80">{formatNum(currentMonthData.Q_h_b_op, 1)}</TableCell>
                                                </TableRow>
                                                <TableRow className="hover:bg-slate-50 border-b border-red-50/50">
                                                    <TableCell className="font-medium flex items-center gap-1.5"><div className="h-3 w-3 rounded-full border border-slate-300" />비사용일 (Non-op)</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-600">{formatNum(currentMonthData.d_we, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.tau_non_op, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.alpha_non_op, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.Q_sink_non_op && currentMonthData.Q_sink_non_op > 0 ? (currentMonthData.Q_source_non_op || 0) / currentMonthData.Q_sink_non_op : 0, 3)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNum(currentMonthData.Q_sink_non_op, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-orange-600/80">{formatNum(currentMonthData.Q_source_non_op, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.eta_h_non_op, 4)}</TableCell>
                                                    <TableCell className="text-right font-mono font-medium text-red-600/80">{formatNum(currentMonthData.Q_h_b_non_op, 1)}</TableCell>
                                                </TableRow>
                                                <TableRow className="bg-red-50/20 hover:bg-red-50/40 font-bold border-t-2 border-red-100">
                                                    <TableCell className="text-red-800">월간 합계 (Total)</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNum((currentMonthData.d_nutz || 0) + (currentMonthData.d_we || 0), 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400 italic">avg</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400 italic">avg</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNum(h?.gamma, 3)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNum(h?.Q_loss, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-orange-600">{formatNum(h?.Q_gain, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNum(h?.eta, 4)}</TableCell>
                                                    <TableCell className="text-right font-mono text-red-700 bg-red-100/30">{formatNum(currentMonthData.Q_h_b, 1)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                        <div className="bg-slate-50/30 px-4 py-2 border-t border-red-100 flex items-center justify-end gap-x-6">
                                            <div className="text-[10px] text-slate-500 font-serif italic">
                                                <InlineMath math="Q_{h,b} = Q_{sink} - \eta_h \cdot Q_{source}" />
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-serif italic">
                                                (<InlineMath math="Q_{sink} = Q_{loss}" />, <InlineMath math="Q_{source} = Q_{gain}" />)
                                            </div>
                                        </div>
                                    </div>

                                    {/* 난방 시스템 손실 상세 (Heating System Loss Breakdown) */}
                                    <div className="mt-6 bg-white rounded-md border border-orange-100 shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 border-b border-orange-100 bg-orange-50/30 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                            <h4 className="text-xs font-bold text-orange-800">
                                                난방 배관 및 저장 손실 상세 (Heating System Loss Breakdown)
                                            </h4>
                                        </div>
                                        <div className="p-0">
                                            <Table className="text-[11px]">
                                                <TableHeader className="bg-orange-50/30">
                                                    <TableRow className="hover:bg-transparent border-b-orange-100">
                                                        <TableHead className="w-24 text-slate-600">구분 (Item)</TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일수 (<InlineMath math="d" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">운전 일수 (<InlineMath math="d" />)</p>
                                                                    해당 운전 모드(사용/비사용)의 월간 일수
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">배관길이 (<InlineMath math="L" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">배관 길이 (<InlineMath math="L" />)</p>
                                                                    난방 배관의 총 길이 (m)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">열관류율 (<InlineMath math="U" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">선형 열관류율 (<InlineMath math="U" />)</p>
                                                                    배관의 단위 길이당 열관류율 (W/mK)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">온도차 (<InlineMath math="\Delta \theta" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">평균 온도차 (<InlineMath math="\Delta \theta" />)</p>
                                                                    배관 내 열매체 평균 온도와 주위 온도의 차이 (K)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right font-bold text-orange-700">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">배관손실 (<InlineMath math="Q_d" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">배관 열손실 (<InlineMath math="Q_d" />)</p>
                                                                    배관을 통한 월간 열손실 (kWh)
                                                                    <div className="mt-1 text-slate-400">
                                                                        <InlineMath math="Q_d = L \cdot U \cdot \Delta \theta \cdot t \cdot 10^{-3}" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">저장용량 (<InlineMath math="V_s" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">저장 탱크 용량 (<InlineMath math="V_s" />)</p>
                                                                    난방 버퍼 탱크의 용량 (Liter)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일일손실 (<InlineMath math="Q_{s,d}" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">일일 저장 손실 (<InlineMath math="Q_{s,d}" />)</p>
                                                                    저장 탱크의 하루 당 열손실 (kWh/d)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">저장손실 (<InlineMath math="Q_s" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">저장 열손실 (<InlineMath math="Q_s" />)</p>
                                                                    저장 탱크의 월간 총 열손실 (kWh)
                                                                    <div className="mt-1 text-slate-400">
                                                                        <InlineMath math="Q_s = Q_{s,d} \cdot d" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    <TableRow className="hover:bg-slate-50 border-b border-orange-50/50">
                                                        <TableCell className="font-medium text-slate-700 flex items-center gap-1.5 pl-4">
                                                            <div className="w-1 h-1 rounded-full bg-orange-400" />
                                                            사용일 (Usage)
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-600">
                                                            {formatNum(
                                                                currentMonthData.systemLosses?.heating?.details?.distribution?.op?.hours && currentMonthData.t_h_op_d
                                                                    ? currentMonthData.systemLosses.heating.details.distribution.op.hours / currentMonthData.t_h_op_d
                                                                    : 0,
                                                                1
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.L, 1)} m</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.U, 2)}</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.op?.dT, 1)} K</TableCell>
                                                        <TableCell className="text-right font-medium text-orange-600 bg-orange-50/10">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.op?.Q_loss, 1)}</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.storage?.V_s, 1)} L</TableCell>
                                                        <TableCell className="text-right text-slate-400">-</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.storage?.op?.Q_loss, 1)}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="hover:bg-slate-50 border-b border-orange-50/50">
                                                        <TableCell className="font-medium text-slate-700 flex items-center gap-1.5 pl-4">
                                                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                            비사용일 (Non-Usage)
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-600">
                                                            {formatNum(
                                                                (currentMonthData.systemLosses?.heating?.details?.distribution?.non_op?.hours || 0) / 24,
                                                                1
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.L, 1)} m</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.U, 2)}</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.non_op?.dT, 1)} K</TableCell>
                                                        <TableCell className="text-right font-medium text-orange-600 bg-orange-50/10">{formatNum(currentMonthData.systemLosses?.heating?.details?.distribution?.non_op?.Q_loss, 1)}</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.storage?.V_s, 1)} L</TableCell>
                                                        <TableCell className="text-right text-slate-400">-</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.heating?.details?.storage?.non_op?.Q_loss, 1)}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="bg-slate-50/30 px-4 py-2 border-t border-orange-100 flex items-center justify-end gap-x-6">
                                            <div className="text-[10px] text-slate-500 font-serif italic">
                                                <InlineMath math="Q_{sys} = Q_d + Q_s" />
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-serif italic">
                                                <InlineMath math="Q_d = L \cdot U \cdot \Delta \theta \cdot t \cdot 10^{-3}" />, <InlineMath math="Q_s = Q_{s,d} \cdot d" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </section>

                        {/* 3) 냉방 상세 */}
                        <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
                            <button
                                onClick={() => toggleStep('step3')}
                                className={cn(
                                    "w-full flex items-center justify-between p-4 transition-colors text-left",
                                    expandedSteps.step3 ? "bg-blue-50/50 border-b border-blue-100" : "hover:bg-blue-50/30"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-700 p-1 rounded font-mono text-sm">Step 3</span>
                                    <h3 className="text-lg font-semibold text-blue-700">냉방 이용률 및 요구량 산출 (Cooling Energy Demand)</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-blue-700 font-bold text-sm">{formatNum(currentMonthData.Q_c_b, 1)} kWh/월</div>
                                    {expandedSteps.step3 ? <ChevronDown className="h-5 w-5 text-blue-300" /> : <ChevronRight className="h-5 w-5 text-blue-300" />}
                                </div>
                            </button>

                            {expandedSteps.step3 && (
                                <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="rounded-md border border-blue-100 overflow-hidden bg-white">
                                        <Table className="text-xs">
                                            <TableHeader className="bg-blue-50/50">
                                                <TableRow className="hover:bg-transparent border-b-blue-100">
                                                    <TableHead className="w-24 text-slate-600">구분 (Item)</TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일수 (<InlineMath math="d" />)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">운전 일수 (<InlineMath math="d" />)</p>
                                                                해당 운전 모드(사용/비사용)의 월간 일수
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="\tau_c" /> (h)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">시상수 (<InlineMath math="\tau_c" />)</p>
                                                                건물의 열적 관성을 나타내는 시간 상수 (시간)
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="a_c" /> (-)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">수치적 매개변수 (<InlineMath math="a_c" />)</p>
                                                                시상수와 유효 열용량에 따른 무차원 매개변수
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="1/\gamma_c" /> (-)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">열손실/열획득 비 (<InlineMath math="1/\gamma_c" />)</p>
                                                                냉방의 경우 열손실과 열획득의 비율 (역수 사용)
                                                                <div className="mt-1 text-slate-400">
                                                                    <InlineMath math="1/\gamma_c = Q_{loss} / Q_{gain}" />
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="Q_{source}" /> (kWh)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">열소스 (<InlineMath math="Q_{source}" />)</p>
                                                                냉방의 경우 총 열획득(<InlineMath math="Q_{gain}" />)과 동일
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="Q_{sink}" /> (kWh)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">열싱크 (<InlineMath math="Q_{sink}" />)</p>
                                                                냉방의 경우 총 열손실(<InlineMath math="Q_{loss}" />)과 동일
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="\eta_c" /> (-)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">이용계수 (<InlineMath math="\eta_c" />)</p>
                                                                열손실이 냉방 부하 감소에 기여하는 비율
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right font-bold text-blue-700 bg-blue-50/50">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2"><InlineMath math="Q_{c,b}" /> (kWh)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">냉방 요구량 (<InlineMath math="Q_{c,b}" />)</p>
                                                                최종적으로 필요한 냉방 에너지
                                                                <div className="mt-1 text-slate-400">
                                                                    <InlineMath math="Q_{c,b} = Q_{source} - \eta_c \cdot Q_{sink}" />
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow className="hover:bg-slate-50 border-b border-blue-50/50">
                                                    <TableCell className="font-medium flex items-center gap-1.5"><Zap className="h-3 w-3 text-blue-400" />사용일 (Usage)</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-600">{formatNum(currentMonthData.d_nutz, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(c?.tau, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(c?.a, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(c && c.gamma > 0 ? 1 / c.gamma : 0, 3)}</TableCell>
                                                    <TableCell className="text-right font-mono text-orange-600/80">{formatNum(c?.Q_gain, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-blue-600/80">{formatNum(c?.Q_loss, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(c?.eta, 4)}</TableCell>
                                                    <TableCell className="text-right font-mono font-medium text-blue-600/80">{formatNum(currentMonthData.Q_c_b_op, 1)}</TableCell>
                                                </TableRow>
                                                <TableRow className="hover:bg-slate-50 border-b border-blue-50/50">
                                                    <TableCell className="font-medium flex items-center gap-1.5"><div className="h-3 w-3 rounded-full border border-slate-300" />비사용일 (Non-op)</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-600">{formatNum(currentMonthData.d_we, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(c?.tau, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(c?.a, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(0, 3)}</TableCell>
                                                    <TableCell className="text-right font-mono text-orange-600/80">{formatNum(0, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-blue-600/80">{formatNum(0, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(0, 4)}</TableCell>
                                                    <TableCell className="text-right font-mono font-medium text-blue-600/80">{formatNum(currentMonthData.Q_c_b_non_op, 1)}</TableCell>
                                                </TableRow>
                                                <TableRow className="bg-blue-50/20 hover:bg-blue-50/40 font-bold border-t-2 border-blue-100">
                                                    <TableCell className="text-blue-800">월간 합계 (Total)</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNum((currentMonthData.d_nutz || 0) + (currentMonthData.d_we || 0), 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400 italic">avg</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400 italic">avg</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNum(c && c.gamma > 0 ? 1 / c.gamma : 0, 3)}</TableCell>
                                                    <TableCell className="text-right font-mono text-orange-600">{formatNum(c?.Q_gain, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-blue-600">{formatNum(c?.Q_loss, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNum(c?.eta, 4)}</TableCell>
                                                    <TableCell className="text-right font-mono text-blue-700 bg-blue-100/30">{formatNum(currentMonthData.Q_c_b, 1)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                        <div className="bg-slate-50/30 px-4 py-2 border-t border-blue-100 flex items-center justify-end gap-x-6">
                                            <div className="text-[10px] text-slate-500 font-serif italic">
                                                <InlineMath math="Q_{c,b} = Q_{source} - \eta_c \cdot Q_{sink}" />
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-serif italic">
                                                (<InlineMath math="Q_{source} = Q_{gain}" />, <InlineMath math="Q_{sink} = Q_{loss}" />)
                                            </div>
                                        </div>
                                    </div>

                                    {/* 냉방 시스템 손실 상세 (Cooling System Loss Breakdown) */}
                                    <div className="mt-6 bg-white rounded-md border border-blue-100 shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            <h4 className="text-xs font-bold text-blue-800">
                                                냉방 배관 및 저장 손실 상세 (Cooling System Loss Breakdown)
                                            </h4>
                                        </div>
                                        <div className="p-0">
                                            <Table className="text-[11px]">
                                                <TableHeader className="bg-blue-50/30">
                                                    <TableRow className="hover:bg-transparent border-b-blue-100">
                                                        <TableHead className="w-24 text-slate-600">구분 (Item)</TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일수 (<InlineMath math="d" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">운전 일수 (<InlineMath math="d" />)</p>
                                                                    해당 운전 모드(사용/비사용)의 월간 일수
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">배관길이 (<InlineMath math="L" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">배관 길이 (<InlineMath math="L" />)</p>
                                                                    냉방 배관의 총 길이 (m)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">열관류율 (<InlineMath math="U" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">선형 열관류율 (<InlineMath math="U" />)</p>
                                                                    배관의 단위 길이당 열관류율 (W/mK)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">온도차 (<InlineMath math="\Delta \theta" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">평균 온도차 (<InlineMath math="\Delta \theta" />)</p>
                                                                    배관 내 냉수 평균 온도와 주위 온도의 차이 (K)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right font-bold text-blue-700">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">배관손실 (<InlineMath math="Q_d" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">배관 열손실 (<InlineMath math="Q_d" />)</p>
                                                                    배관을 통한 월간 열손실 (kWh)
                                                                    <div className="mt-1 text-slate-400">
                                                                        <InlineMath math="Q_d = L \cdot U \cdot \Delta \theta \cdot t \cdot 10^{-3}" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">저장용량 (<InlineMath math="V_s" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">저장 탱크 용량 (<InlineMath math="V_s" />)</p>
                                                                    냉방 버퍼 탱크의 용량 (Liter)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일일손실 (<InlineMath math="Q_{s,d}" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">일일 저장 손실 (<InlineMath math="Q_{s,d}" />)</p>
                                                                    저장 탱크의 하루 당 열손실 (kWh/d)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">저장손실 (<InlineMath math="Q_s" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">저장 열손실 (<InlineMath math="Q_s" />)</p>
                                                                    저장 탱크의 월간 총 열손실 (kWh)
                                                                    <div className="mt-1 text-slate-400">
                                                                        <InlineMath math="Q_s = Q_{s,d} \cdot d" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    <TableRow className="hover:bg-slate-50 border-b border-blue-50/50">
                                                        <TableCell className="font-medium text-slate-700 flex items-center gap-1.5 pl-4">
                                                            <div className="w-1 h-1 rounded-full bg-blue-400" />
                                                            사용일 (Usage)
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-600">
                                                            {formatNum(
                                                                currentMonthData.systemLosses?.cooling?.details?.distribution?.op?.hours && currentMonthData.t_c_op_d
                                                                    ? currentMonthData.systemLosses.cooling.details.distribution.op.hours / currentMonthData.t_c_op_d
                                                                    : 0,
                                                                1
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.cooling?.details?.distribution?.L, 1)} m</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.cooling?.details?.distribution?.U, 2)}</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.cooling?.details?.distribution?.op?.dT, 1)} K</TableCell>
                                                        <TableCell className="text-right font-medium text-blue-600 bg-blue-50/10">{formatNum(currentMonthData.systemLosses?.cooling?.details?.distribution?.op?.Q_loss, 1)}</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.cooling?.details?.storage?.V_s, 1)} L</TableCell>
                                                        <TableCell className="text-right text-slate-400">-</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.cooling?.details?.storage?.op?.Q_loss, 1)}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="hover:bg-slate-50 border-b border-blue-50/50">
                                                        <TableCell className="font-medium text-slate-700 flex items-center gap-1.5 pl-4">
                                                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                            비사용일 (Non-Usage)
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-600">
                                                            {formatNum(
                                                                (currentMonthData.systemLosses?.cooling?.details?.distribution?.non_op?.hours || 0) / 24,
                                                                1
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.cooling?.details?.distribution?.L, 1)} m</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.cooling?.details?.distribution?.U, 2)}</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.cooling?.details?.distribution?.non_op?.dT, 1)} K</TableCell>
                                                        <TableCell className="text-right font-medium text-blue-600 bg-blue-50/10">{formatNum(currentMonthData.systemLosses?.cooling?.details?.distribution?.non_op?.Q_loss, 1)}</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.cooling?.details?.storage?.V_s, 1)} L</TableCell>
                                                        <TableCell className="text-right text-slate-400">-</TableCell>
                                                        <TableCell className="text-right text-slate-500">{formatNum(currentMonthData.systemLosses?.cooling?.details?.storage?.non_op?.Q_loss, 1)}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="bg-slate-50/30 px-4 py-2 border-t border-blue-100 flex items-center justify-end gap-x-6">
                                            <div className="text-[10px] text-slate-500 font-serif italic">
                                                <InlineMath math="Q_{sys} = Q_d + Q_s" />
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-serif italic">
                                                <InlineMath math="Q_d = L \cdot U \cdot \Delta \theta \cdot t \cdot 10^{-3}" />, <InlineMath math="Q_s = Q_{s,d} \cdot d" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </section>

                        {/* 4) 조명 요구량 및 열획득 상세 */}
                        <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
                            <button
                                onClick={() => toggleStep('step4')}
                                className={cn(
                                    "w-full flex items-center justify-between p-4 transition-colors text-left",
                                    expandedSteps.step4 ? "bg-yellow-50/50 border-b border-yellow-100" : "hover:bg-yellow-50/30"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="bg-yellow-100 text-yellow-700 p-1 rounded font-mono text-sm">Step 4</span>
                                    <h3 className="text-lg font-semibold text-yellow-700">조명 요구량 및 열획득 상세 (Lighting Demand Verification)</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-yellow-700 font-bold text-sm">{formatNum(currentMonthData.Q_l_b, 1)} kWh/월</div>
                                    {expandedSteps.step4 ? <ChevronDown className="h-5 w-5 text-yellow-300" /> : <ChevronRight className="h-5 w-5 text-yellow-300" />}
                                </div>
                            </button>

                            {expandedSteps.step4 && (
                                <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="rounded-md border border-yellow-100 overflow-hidden bg-white">
                                        <Table className="text-xs">
                                            <TableHeader className="bg-yellow-50/50">
                                                <TableRow className="hover:bg-transparent border-b-yellow-100">
                                                    <TableHead className="w-24 text-slate-600">구분 (Item)</TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">면적 (<InlineMath math="A" />) (m²)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">조명 부하 산정의 기준이 되는 존의 유효 가동 바닥 면적 (Nettofläche)</TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">유지조도 (<InlineMath math="E_m" />) (lx)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">DIN 18599-10/Profiles에 따른 요구 유지조도 레벨</TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">조명밀도 (<InlineMath math="P_{inst}" />) (W/m²)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">{"설치 조명 설비의 전력량 밀도 ($100 \\text{lx}$ 당 $W/m^2$ 기반 산출)"}</TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">사용시간 (<InlineMath math="t_{occ}" />) (h/d)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">해당 존의 일간 조명 가동(재실) 시간</TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right font-bold text-yellow-700">요구량 (<InlineMath math="Q_{l,b}" />) (kWh)</TableHead>
                                                    <TableHead className="text-right font-bold text-orange-600">열획득 (<InlineMath math="Q_{I,l}" />) (kWh)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow className="hover:bg-slate-50 border-b border-yellow-50/50">
                                                    <TableCell className="font-medium flex items-center gap-1.5"><Zap className="h-3 w-3 text-yellow-400" />사용일 (Usage)</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-600 font-medium">{formatNum(zone?.area, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(profile.illuminance, 0)}</TableCell>
                                                    <TableCell className="text-right font-mono text-yellow-600">{formatNum(currentMonthData.internalGains?.metadata?.p_j, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.t_usage, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono font-medium text-yellow-700">{formatNum(currentMonthData.internalGains?.op?.Q_l_b, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono font-medium text-orange-600/80 font-bold">{formatNum(currentMonthData.internalGains?.op?.Q_I_l, 1)}</TableCell>
                                                </TableRow>
                                                <TableRow className="hover:bg-slate-50 border-b border-yellow-50/50">
                                                    <TableCell className="font-medium flex items-center gap-1.5"><div className="h-3 w-3 rounded-full border border-slate-300" />비사용일 (Non-op)</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400">-</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400">-</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400">-</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400">-</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.non_op?.Q_l_b, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.non_op?.Q_I_l, 1)}</TableCell>
                                                </TableRow>
                                                <TableRow className="bg-yellow-50/20 hover:bg-yellow-50/40 font-bold border-t-2 border-yellow-100">
                                                    <TableCell className="text-yellow-800">월간 합계 (Total)</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400 italic font-normal">Sum</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400 italic font-normal">-</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400 italic font-normal">-</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400 italic font-normal">-</TableCell>
                                                    <TableCell className="text-right font-mono text-yellow-700 font-bold text-[13px]">{formatNum(currentMonthData.Q_l_b, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-orange-700 font-bold text-[13px]">{formatNum(currentMonthData.internalGains?.Q_I_l, 1)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                        <div className="bg-slate-50/80 px-4 py-3 border-t border-yellow-100 text-center">
                                            <div className="text-[12px] text-yellow-800 font-serif flex items-center justify-center gap-4">
                                                <InlineMath math="Q_{l,b} = P_{inst} \cdot A \cdot t_{occ} \cdot d_{mth} \cdot 10^{-3}" />
                                                <div className="w-px h-3 bg-slate-300" />
                                                <InlineMath math="Q_{I,l} = Q_{l,b} \cdot 1.0" />
                                            </div>
                                            <div className="text-[10px] text-slate-400 italic mt-1.5 leading-relaxed">
                                                조명 에너지 요구량 및 실내 열획득 산정 (100% Heat Gain Factor 적용)
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* 5) 급탕 요구량 및 열획득 상세 */}
                        <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
                            <button
                                onClick={() => toggleStep('step5')}
                                className={cn(
                                    "w-full flex items-center justify-between p-4 transition-colors text-left",
                                    expandedSteps.step5 ? "bg-blue-50/50 border-b border-blue-100" : "hover:bg-blue-50/30"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-800 p-1 rounded font-mono text-sm">Step 5</span>
                                    <h3 className="text-lg font-semibold text-blue-800">급탕 요구량 및 열획득 상세 (DHW Verification)</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-blue-700 font-bold text-sm">{formatNum(currentMonthData.Q_w_b, 1)} kWh/월</div>
                                    {expandedSteps.step5 ? <ChevronDown className="h-5 w-5 text-blue-300" /> : <ChevronRight className="h-5 w-5 text-blue-300" />}
                                </div>
                            </button>

                            {expandedSteps.step5 && (
                                <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="rounded-md border border-blue-100 overflow-hidden bg-white">
                                        <Table className="text-xs">
                                            <TableHeader className="bg-blue-50/50">
                                                <TableRow className="hover:bg-transparent border-b-blue-100">
                                                    <TableHead className="w-24 text-slate-600">구분 (Item)</TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">면적 (<InlineMath math="A_{NGF}" />) (m²)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">참조 바닥 면적 (<InlineMath math="A_{NGF}" />)</p>
                                                                급탕 수요가 발생하는 유효 바닥 면적 (Nettogrundfläche)
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">원단위 (<InlineMath math="q_{w,b,day}" />)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">급탕 원단위 (<InlineMath math="q_{w,b,day}" />)</p>
                                                                단위 면적당 일일 급탕 에너지 요구량 (Wh/m²d)
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일수 (<InlineMath math="d" />)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">운영 일수 (<InlineMath math="d" />)</p>
                                                                월간 급탕 설비 가동 일수
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                    <TableHead className="text-right font-bold text-blue-700">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">요구량 (<InlineMath math="Q_{w,b}" />)</span></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                <p className="font-bold mb-1">급탕 에너지 요구량 (<InlineMath math="Q_{w,b}" />)</p>
                                                                최종 유효 급탕 에너지 수요 (kWh/월)
                                                                <div className="mt-1 text-slate-400">
                                                                    <InlineMath math="Q_{w,b} = q_{w,b,day} \cdot A_{NGF} \cdot d \cdot 10^{-3}" />
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow className="hover:bg-slate-50 border-b border-blue-50/50">
                                                    <TableCell className="font-medium flex items-center gap-1.5">
                                                        <Droplets className="h-3 w-3 text-blue-400" />
                                                        사용일 (Usage)
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-slate-600 font-medium">{formatNum(currentMonthData.internalGains?.metadata?.A_NGF || zone?.area, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.q_w_b_day, 1)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.d_nutz, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono font-medium text-blue-700">{formatNum(currentMonthData.internalGains?.op?.Q_w_b, 1)}</TableCell>
                                                </TableRow>
                                                <TableRow className="hover:bg-slate-50 border-b border-blue-50/50 italic opacity-85">
                                                    <TableCell className="font-medium flex items-center gap-1.5">
                                                        <div className="h-3 w-3 rounded-full border border-slate-300" />
                                                        비사용일 (Non-op)
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400">-</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400">-</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.d_non, 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.non_op?.Q_w_b, 1)}</TableCell>
                                                </TableRow>
                                                <TableRow className="bg-blue-50/20 hover:bg-blue-50/40 font-bold border-t-2 border-blue-100">
                                                    <TableCell className="text-blue-800">월간 합계 (Total)</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400 italic font-normal">Sum</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-400 italic font-normal">-</TableCell>
                                                    <TableCell className="text-right font-mono text-slate-600 font-medium">{formatNum((currentMonthData.internalGains?.metadata?.d_nutz || 0) + (currentMonthData.internalGains?.metadata?.d_non || 0), 2)}</TableCell>
                                                    <TableCell className="text-right font-mono text-blue-700 font-bold text-[13px]">{formatNum(currentMonthData.Q_w_b, 1)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                        {/* 메인 테이블 하단 공식 */}
                                        <div className="bg-slate-50/30 px-4 py-2 border-t border-blue-100 flex flex-wrap items-center justify-end gap-x-6">
                                            <div className="text-[10px] text-slate-500 font-serif italic">
                                                <InlineMath math="Q_{w,b} = q_{w,b,day} \cdot A_{NGF} \cdot d_{op} \cdot 10^{-3}" />
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-serif italic">
                                                * 배관 및 저장 손실 상세 내역은 하단 테이블 참조
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 5-1: 급탕 배관 및 저장 손실 상세 */}
                                    <div className="mt-6 bg-white rounded-md border border-blue-100 shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            <h4 className="text-xs font-bold text-blue-800">
                                                급탕 배관 및 저장 손실 상세 (DHW Loss Breakdown)
                                            </h4>
                                        </div>
                                        <div className="p-0">
                                            <Table className="text-[11px]">
                                                <TableHeader className="bg-blue-50/30">
                                                    <TableRow className="hover:bg-transparent border-b-blue-100">
                                                        <TableHead className="w-20 text-slate-600">구분</TableHead>
                                                        <TableHead className="text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일수 (<InlineMath math="d" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">운영 일수 (<InlineMath math="d" />)</p>
                                                                    해당 운영 모드(사용/비사용)가 적용되는 월간 일수입니다.
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right text-slate-500">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">배관길이 (<InlineMath math="L_{w,d}" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">배관 길이 (<InlineMath math="L_{w,d}" />)</p>
                                                                    급탕 배관의 총 길이입니다.
                                                                    <div className="mt-1 text-slate-400">
                                                                        기본 산정식: <InlineMath math="L_{w,d} = 10 + 0.1 \cdot A_{NGF}" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right text-slate-500">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">열관류율 (<InlineMath math="U_l" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">선형 열관류율 (<InlineMath math="U_l" />)</p>
                                                                    배관 단열 성능을 나타내는 선형 열관류율 (W/mK)입니다.
                                                                    <div className="mt-1 text-slate-400">
                                                                        표준 단열 기준: <InlineMath math="0.25 \, \text{W/mK}" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right text-slate-500">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">온도차 (<InlineMath math="\theta_{w,av} - \theta_i" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">평균 온도차 (<InlineMath math="\theta_{w,av} - \theta_i" />)</p>
                                                                    배관 내 온수 평균 온도와 주위 실내 온도의 차이입니다.
                                                                    <div className="mt-1 text-slate-400">
                                                                        산정식: <InlineMath math="\Delta \theta = 60^\circ\text{C} - \theta_i" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right font-semibold text-blue-700">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">배관손실 (<InlineMath math="Q_{w,d}" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">배관 열손실 (<InlineMath math="Q_{w,d}" />)</p>
                                                                    배관 표면을 통해 손실되는 열량입니다.
                                                                    <div className="mt-1 text-slate-400">
                                                                        <InlineMath math="Q_{w,d} = L_{w,d} \cdot U_l \cdot \Delta \theta \cdot 24 \cdot d" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right text-slate-500">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">저장용량 (<InlineMath math="V_s" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">저장 탱크 용량 (<InlineMath math="V_s" />)</p>
                                                                    급탕 저장 탱크의 용량입니다.
                                                                    <div className="mt-1 text-slate-400">
                                                                        산정식: <InlineMath math="V_s = \max(30, (A_{NGF} / 40) \cdot 100)" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right text-slate-500">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">일일손실 (<InlineMath math="q_{w,s,day}" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">일일 대기 손실 (<InlineMath math="q_{w,s,day}" />)</p>
                                                                    저장 탱크의 하루 대기 열손실량입니다.
                                                                    <div className="mt-1 text-slate-400">
                                                                        산정식 (Wh/d): <InlineMath math="q_{w,s,day} = (0.8 + 0.02 \cdot V_s^{0.77}) \cdot 10^3" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                        <TableHead className="text-right font-semibold text-blue-700">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help decoration-dotted underline underline-offset-2">저장손실 (<InlineMath math="Q_{w,s}" />)</span></TooltipTrigger>
                                                                <TooltipContent className="max-w-xs p-2 text-[11px]">
                                                                    <p className="font-bold mb-1">저장 열손실 (<InlineMath math="Q_{w,s}" />)</p>
                                                                    저장 탱크에서 발생하는 월간 총 열손실입니다.
                                                                    <div className="mt-1 text-slate-400">
                                                                        <InlineMath math="Q_{w,s} = q_{w,s,day} \cdot d \cdot 10^{-3}" />
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {/* 사용일 */}
                                                    <TableRow className="hover:bg-slate-50 border-b border-blue-50/50">
                                                        <TableCell className="font-medium text-slate-700">사용일</TableCell>
                                                        <TableCell className="text-right font-mono">{formatNum(currentMonthData.internalGains?.metadata?.d_nutz, 2)}</TableCell>

                                                        {/* 배관 파라미터 */}
                                                        <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.L_w_d, 1)} m</TableCell>
                                                        <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.U_l_w_d, 2)}</TableCell>
                                                        <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.dT_pipe, 1)} K</TableCell>
                                                        <TableCell className="text-right font-mono font-medium text-blue-600">{formatNum(currentMonthData.internalGains?.op?.Q_w_d, 1)}</TableCell>

                                                        {/* 저장 파라미터 */}
                                                        <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.V_storage, 0)} L</TableCell>
                                                        <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.q_w_s_day, 1)} Wh</TableCell>
                                                        <TableCell className="text-right font-mono font-medium text-blue-600">{formatNum(currentMonthData.internalGains?.op?.Q_w_s, 1)}</TableCell>
                                                    </TableRow>

                                                    {/* 비사용일 */}
                                                    <TableRow className="hover:bg-slate-50 border-b border-blue-50/50">
                                                        <TableCell className="font-medium text-slate-500">비사용일</TableCell>
                                                        <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.d_non, 2)}</TableCell>

                                                        {/* 배관 파라미터 (비사용일은 해당 없음 표현) */}
                                                        <TableCell className="text-right font-mono text-slate-300">-</TableCell>
                                                        <TableCell className="text-right font-mono text-slate-300">-</TableCell>
                                                        <TableCell className="text-right font-mono text-slate-300">-</TableCell>
                                                        <TableCell className="text-right font-mono text-slate-400">{formatNum(currentMonthData.internalGains?.non_op?.Q_w_d, 1)}</TableCell>

                                                        {/* 저장 파라미터 (상시 가동 가정 시 표시) */}
                                                        <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.V_storage, 0)} L</TableCell>
                                                        <TableCell className="text-right font-mono text-slate-500">{formatNum(currentMonthData.internalGains?.metadata?.q_w_s_day, 1)} Wh</TableCell>
                                                        <TableCell className="text-right font-mono font-medium text-blue-600">{formatNum(currentMonthData.internalGains?.non_op?.Q_w_s, 1)}</TableCell>
                                                    </TableRow>

                                                    {/* 합계 */}
                                                    <TableRow className="bg-blue-50/20 font-bold text-blue-900">
                                                        <TableCell>합계</TableCell>
                                                        <TableCell className="text-right font-mono">{formatNum((currentMonthData.internalGains?.metadata?.d_nutz || 0) + (currentMonthData.internalGains?.metadata?.d_non || 0), 2)}</TableCell>
                                                        <TableCell className="text-right text-slate-300">-</TableCell>
                                                        <TableCell className="text-right text-slate-300">-</TableCell>
                                                        <TableCell className="text-right text-slate-300">-</TableCell>
                                                        <TableCell className="text-right font-mono">{formatNum(currentMonthData.internalGains?.metadata?.Q_w_d, 1)}</TableCell>
                                                        <TableCell className="text-right text-slate-300">-</TableCell>
                                                        <TableCell className="text-right text-slate-300">-</TableCell>
                                                        <TableCell className="text-right font-mono">{formatNum(currentMonthData.internalGains?.metadata?.Q_w_s, 1)}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    {/* 수식 */}
                                    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-3 bg-slate-50/30 border-t border-blue-50 mt-6">
                                        <div className="text-[10px] text-blue-800 font-serif opacity-80">
                                            <InlineMath math="Q_{w,d} = L_{w,d} \cdot U_l \cdot (\theta_{w,av} - \theta_i) \cdot 24 \cdot d \cdot 10^{-3}" />
                                        </div>
                                        <div className="text-[10px] text-blue-800 font-serif opacity-80">
                                            <InlineMath math="Q_{w,s} = q_{w,s,day} \cdot d \cdot 10^{-3}" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* 6. 용어 및 수식 참고 (Step 6) */}
                    <section className="mt-8 border rounded-xl overflow-hidden shadow-sm bg-white">
                        <button
                            onClick={() => toggleStep('step6')}
                            className={cn(
                                "w-full flex items-center justify-between p-4 transition-colors text-left",
                                expandedSteps.step6 ? "bg-slate-50 border-b" : "hover:bg-slate-50/50"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <span className="bg-slate-100 text-slate-700 p-1 rounded font-mono text-sm">Step 6</span>
                                <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <Info className="h-5 w-5" /> 주요 파라미터 정의 (Parameter Definitions)
                                </h3>
                            </div>
                            {expandedSteps.step6 ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                        </button>

                        {expandedSteps.step6 && (
                            <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="rounded-md border overflow-hidden">
                                    <Table className="text-[11px]">
                                        <TableHeader className="bg-slate-50/80">
                                            <TableRow>
                                                <TableHead className="w-24">변수 (Symbol)</TableHead>
                                                <TableHead>설명 (Description)</TableHead>
                                                <TableHead className="w-24 text-center">단위</TableHead>
                                                <TableHead className="w-32">출처 (Source)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold"><InlineMath math="\tau" /></TableCell>
                                                <TableCell>시간 상수 (Time Constant). 건물의 열적 관성을 나타내며, 유효 열용량(<InlineMath math="C_m" />)과 총 전열계수(<InlineMath math="H" />)의 비로 계산.</TableCell>
                                                <TableCell className="text-center font-mono">h</TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN/TS 18599-2</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold"><InlineMath math="\gamma" /></TableCell>
                                                <TableCell>이득/손실 비 (Gain-Loss Ratio). 열획득 총합(<InlineMath math="Q_{source}" />)과 열손실 총합(<InlineMath math="Q_{sink}" />)의 비율.</TableCell>
                                                <TableCell className="text-center font-mono">-</TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN/TS 18599-2</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold"><InlineMath math="Q_{h,b}" /></TableCell>
                                                <TableCell>난방 에너지 요구량 (Heating Demand). 건물의 설계 온도를 유지하기 위해 필요한 열에너지.</TableCell>
                                                <TableCell className="text-center font-mono">kWh/월</TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN/TS 18599-2</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold"><InlineMath math="Q_{c,b}" /></TableCell>
                                                <TableCell>냉방 에너지 요구량 (Cooling Demand). 건물을 냉각하기 위해 제거해야 할 총 열량.</TableCell>
                                                <TableCell className="text-center font-mono">kWh/월</TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN/TS 18599-2</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold"><InlineMath math="Q_{l,b}" /></TableCell>
                                                <TableCell>조명 에너지 요구량 (Lighting Demand). 조명 설비 가동을 위해 필요한 총 전기 에너지 소비량.</TableCell>
                                                <TableCell className="text-center font-mono">kWh/월</TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN/TS 18599-4</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold"><InlineMath math="Q_{w,b}" /></TableCell>
                                                <TableCell>급탕 에너지 요구량 (DHW Demand). 건물의 온수 소비를 충족하기 위해 필요한 열에너지.</TableCell>
                                                <TableCell className="text-center font-mono">kWh/월</TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN/TS 18599-8</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold"><InlineMath math="Q_{I,p}" /></TableCell>
                                                <TableCell>재실자 내부 열획득 (Occupancy Gain). 사람의 신진대사로 인해 실내로 방출되는 열량.</TableCell>
                                                <TableCell className="text-center font-mono">kWh/월</TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN/TS 18599-10</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold"><InlineMath math="Q_{I,l}" /></TableCell>
                                                <TableCell>조명 내부 열획득 (Lighting Heat Gain). 조명 기구에서 실내로 유입되는 열량.</TableCell>
                                                <TableCell className="text-center font-mono">kWh/월</TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN/TS 18599-4</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold"><InlineMath math="Q_{I,fac}" /></TableCell>
                                                <TableCell>기기 내부 열획득 (Equipment Gain). 전자기기 및 설비의 가동으로 인해 발생하는 열량.</TableCell>
                                                <TableCell className="text-center font-mono">kWh/월</TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN/TS 18599-10</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold"><InlineMath math="Q_{I,w}" /></TableCell>
                                                <TableCell>급탕 시스템 내부 열획득 (DHW Heat Gain). 온수 시스템 손실 중 실내로 유입되는 열량.</TableCell>
                                                <TableCell className="text-center font-mono">kWh/월</TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN/TS 18599-8</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="mt-4 p-3 bg-slate-50 rounded text-[10px] text-slate-500 italic">
                                    * 모든 계산은 DIN/TS 18599:2025-10 표준 방법론을 준수합니다.
                                </div>
                            </div>
                        )}
                    </section>

                    {/* 7. 시스템 손실 기본값 가정 (Default System Loss Assumptions) */}
                    <section className="mt-8 border rounded-xl overflow-hidden shadow-sm bg-white">
                        <button
                            onClick={() => toggleStep('loss_assumptions')}
                            className={cn(
                                "w-full flex items-center justify-between p-4 transition-colors text-left",
                                expandedSteps.loss_assumptions ? "bg-orange-50 border-b border-orange-100" : "hover:bg-orange-50/50"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <span className="bg-orange-100 text-orange-800 p-1 rounded font-mono text-sm">Note</span>
                                <h3 className="text-lg font-semibold text-orange-900 flex items-center gap-2">
                                    <Info className="h-5 w-5" /> 시스템 손실 기본값 가정 (Default System Loss Assumptions)
                                </h3>
                            </div>
                            {expandedSteps.loss_assumptions ? <ChevronDown className="h-5 w-5 text-orange-400" /> : <ChevronRight className="h-5 w-5 text-orange-400" />}
                        </button>

                        {expandedSteps.loss_assumptions && (
                            <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="text-sm text-slate-600 mb-4 bg-orange-50/50 p-3 rounded border border-orange-100">
                                    초기 설계 단계에서 설비 상세 정보(배관 길이, 버퍼 탱크 용량 등)가 입력되지 않은 경우, <strong>DIN V 18599</strong> 표준에 근거하여 아래와 같은 기본값을 자동 적용합니다.
                                </div>
                                <div className="rounded-md border border-orange-100 overflow-hidden">
                                    <Table className="text-xs">
                                        <TableHeader className="bg-orange-50/80">
                                            <TableRow className="border-b-orange-100">
                                                <TableHead className="w-32 font-bold text-orange-900">구분 (Category)</TableHead>
                                                <TableHead className="w-48 font-bold text-orange-900">항목 (Item)</TableHead>
                                                <TableHead className="font-bold text-orange-900">기본값 적용 로직 (Default Logic)</TableHead>
                                                <TableHead className="w-32 font-bold text-orange-900">출처 (Source)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow className="hover:bg-orange-50/30">
                                                <TableCell className="font-medium text-slate-700" rowSpan={2}>배관 (Pipe)</TableCell>
                                                <TableCell className="font-medium">배관 길이 (<InlineMath math="L_{max}" />)</TableCell>
                                                <TableCell className="font-mono text-slate-600">
                                                    <div className="flex flex-col gap-1">
                                                        <span><InlineMath math="L_{max} = 2 \cdot (l_{char} + b_{char} + n_G \cdot h_G + l_d)" /></span>
                                                        <span className="text-[10px] text-slate-400">
                                                            여기서 <InlineMath math="l_{char} = \sqrt{A_{NGF}}" />, <InlineMath math="b_{char} = l_{char}" />, <InlineMath math="h_G=3m" />, <InlineMath math="l_d=10m" />
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground italic">DIN V 18599-5</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-orange-50/30">
                                                <TableCell className="font-medium">온도차 (<InlineMath math="\Delta \theta" />)</TableCell>
                                                <TableCell className="font-mono text-slate-600">
                                                    <div className="flex flex-col gap-1">
                                                        <span><InlineMath math="\Delta \theta = |\theta_{medium} - \theta_{ambient}|" /></span>
                                                        <span className="text-[10px] text-slate-500">
                                                            • 난방: <InlineMath math="50^{\circ}C - 20^{\circ}C = 30K" /> (70/50 운영 기준)
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            • 냉방: <InlineMath math="20^{\circ}C - 9^{\circ}C = 11K" /> (비냉방 공간 통과 기준)
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground italic">Standard Practice</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-orange-50/30">
                                                <TableCell className="font-medium text-slate-700 border-t border-orange-100">저장 (Storage)</TableCell>
                                                <TableCell className="font-medium border-t border-orange-100">버퍼 탱크 용량 (<InlineMath math="V_S" />)</TableCell>
                                                <TableCell className="font-mono text-slate-600 border-t border-orange-100">
                                                    <div className="flex flex-col gap-1">
                                                        <span><InlineMath math="V_S \approx 1.0 \cdot A_{NGF}" /> (Liters)</span>
                                                        <span className="text-[10px] text-slate-400">
                                                            면적(<InlineMath math="m^2" />) 당 약 1.0 리터로 추정
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground italic border-t border-orange-100">Rule of Thumb</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </section>
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
