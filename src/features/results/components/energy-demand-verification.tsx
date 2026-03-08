"use client";

import React from "react";
import { MonthlyResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Zone } from "@/types/project";
import { DIN_18599_PROFILES } from "@/lib/din-18599-profiles";

import { useVerificationState } from "../hooks/use-verification-state";
import { MonthSelector } from "./shared/verification-ui";

// 분리된 서브 섹션 컴포넌트들
import { SummarySection } from "./energy-demand/summary-section";
import { HeatingSection } from "./energy-demand/heating-section";
import { CoolingSection } from "./energy-demand/cooling-section";
import { LightingSection } from "./energy-demand/lighting-section";
import { DHWSection } from "./energy-demand/dhw-section";
import { DefinitionSection } from "./energy-demand/definition-section";
import { LossAssumptionsSection } from "./energy-demand/loss-assumptions-section";

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
    // 중앙 집중식 상태 관리 훅 적용
    const { expandedSteps, toggleStep, toggleAll } = useVerificationState(data);

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
    } : currentMonthDataRaw;

    const meta = currentMonthData.energyDemandMetadata;
    const h = meta?.heating;
    const c = meta?.cooling;

    const profile = zone?.usageType ? (DIN_18599_PROFILES[zone.usageType] || DIN_18599_PROFILES["1_office"]) : DIN_18599_PROFILES["1_office"];

    return (
        <TooltipProvider>
            <Card className="w-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                    <div>
                        <CardTitle>{title || "에너지 요구량 상세 검증 (Energy Demand Verification)"}</CardTitle>
                        <CardDescription>DIN/TS 18599-2 기반 유효 에너지 요구량(Nutzenergie) 및 이용률 분석</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <MonthSelector 
                            months={data.map(m => m.month)} 
                            value={selectedMonth} 
                            onChange={onMonthChange} 
                        />
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
                    <SummarySection 
                        currentMonthData={currentMonthData}
                        h={h}
                        c={c}
                        isExpanded={expandedSteps.step1}
                        onToggle={() => toggleStep("step1")}
                    />

                    <div className="h-px bg-slate-200 my-8" />

                    <div className="grid grid-cols-1 gap-14">
                        {/* 2. 난방 상세 (Step 2) */}
                        <HeatingSection 
                            currentMonthData={currentMonthData}
                            h={h}
                            isExpanded={expandedSteps.step2}
                            onToggle={() => toggleStep("step2")}
                        />

                        {/* 3. 냉방 상세 (Step 3) */}
                        <CoolingSection 
                            currentMonthData={currentMonthData}
                            c={c}
                            isExpanded={expandedSteps.step3}
                            onToggle={() => toggleStep("step3")}
                        />

                        {/* 4. 조명 상세 (Step 4) */}
                        <LightingSection 
                            currentMonthData={currentMonthData}
                            zone={zone}
                            profile={profile}
                            isExpanded={expandedSteps.step4}
                            onToggle={() => toggleStep("step4")}
                        />

                        {/* 5. 급탕 상세 (Step 5) */}
                        <DHWSection 
                            currentMonthData={currentMonthData}
                            zone={zone}
                            isExpanded={expandedSteps.step5}
                            onToggle={() => toggleStep("step5")}
                        />
                    </div>

                    {/* 6. 용어 및 수식 참고 (Step 6) */}
                    <DefinitionSection 
                        isExpanded={expandedSteps.step6}
                        onToggle={() => toggleStep("step6")}
                    />

                    {/* 7. 시스템 손실 기본값 가정 */}
                    <LossAssumptionsSection 
                        isExpanded={expandedSteps.loss_assumptions}
                        onToggle={() => toggleStep("loss_assumptions")}
                    />
                    
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
