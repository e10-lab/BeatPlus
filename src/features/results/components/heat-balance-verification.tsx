"use client";

import React, { useState, useCallback } from "react";
import { MonthlyResult } from "@/engine/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";
import {
  ChevronDown,
  ChevronRight,
  PlayCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Zone } from "@/types/project";
import { DIN_18599_PROFILES } from "@/lib/din-18599-profiles";
import { cn } from "@/lib/utils";
import { runVerifications, VerificationResult } from "../services/verification-service";
import { formatNum } from "../utils/formatters";
import { VerificationSection, MonthSelector, MathTooltip } from "./shared/verification-ui";
import { useVerificationState } from "../hooks/use-verification-state";

interface HeatBalanceVerificationProps {
  data: MonthlyResult[];
  title?: string;
  zone?: Zone;
  selectedMonth: number;
  selectedIterationStep: number | null;
  onMonthChange: (month: number) => void;
  onIterationSelect: (step: number | null) => void;
}

export function HeatBalanceVerification({
  data,
  title,
  zone,
  selectedMonth: externalMonth,
  selectedIterationStep: externalIterationStep,
  onMonthChange,
  onIterationSelect,
}: HeatBalanceVerificationProps) {
  const {
    expandedSteps,
    toggleStep,
    toggleAll,
    selectedMonth,
    selectedIterationStep,
    currentMonthData,
    handleMonthChange,
    handleIterationSelect
  } = useVerificationState(data, { 
    externalMonth, 
    externalIterationStep 
  });

  // 상태 변경 외부 전파 - 여전히 필요하지만 이제 훅 내부 상태와 외부 상태가 통합됨
  React.useEffect(() => {
    if (onMonthChange && externalMonth === undefined) onMonthChange(selectedMonth);
  }, [selectedMonth, onMonthChange, externalMonth]);

  React.useEffect(() => {
    if (onIterationSelect && externalIterationStep === undefined) onIterationSelect(selectedIterationStep);
  }, [selectedIterationStep, onIterationSelect, externalIterationStep]);

  const [verificationResults, setVerificationResults] = useState<VerificationResult[] | null>(null);

  const handleRunVerification = useCallback(() => {
    const results = runVerifications();
    setVerificationResults(results);
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        데이터가 없습니다.
      </div>
    );
  }

  const balanceMode = "heating"; 
  const isHeating = balanceMode === "heating";

  const profile = zone?.usageType ? DIN_18599_PROFILES[zone.usageType] : null;

  // 요약 변수
  const Q_sources = isHeating 
    ? (currentMonthData.QS + currentMonthData.QI) 
    : (currentMonthData.QV_cool + currentMonthData.QT_cool);
  const Q_sinks = isHeating 
    ? (currentMonthData.QT_heat + currentMonthData.QV_heat) 
    : (currentMonthData.QS + currentMonthData.QI);
  const eta = isHeating ? (currentMonthData.eta || 0) : (currentMonthData.eta_C || 0);
  const Q_b = isHeating ? currentMonthData.Q_h_b : currentMonthData.Q_c_b;

  // Step 2 변수
  const Ti_eff = isHeating 
    ? (currentMonthData.Theta_i_h || currentMonthData.avg_Ti || 0) 
    : (currentMonthData.Theta_int_C || currentMonthData.avg_Ti_c || 0);
  const Te = currentMonthData.Theta_e || 0;
  const Ti_set = isHeating ? (profile?.heatingSetpoint ?? 0) : (profile?.coolingSetpoint ?? 0);

  // Step 3 변수
  const internalGains = currentMonthData.internalGains || { Q_occ: 0, Q_app: 0, Q_lit: 0, Q_dhw: 0 };
  const systemLosses = currentMonthData.systemLosses || { heating: { generation: 0, distribution: 0, storage: 0 }, cooling: { distribution: 0, storage: 0 } };

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div>
            <CardTitle>{title || "상세 열수지 분석 (Detailed Heat Balance)"}</CardTitle>
            <CardDescription>
              ISO 13790 / DIN 18599 알고리즘에 따른 월간 열획득(Gain)과 열손실(Loss) 상세 검증
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <MonthSelector
              months={data.map((m) => m.month)}
              value={selectedMonth}
              onChange={handleMonthChange}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 text-primary"
              onClick={handleRunVerification}
            >
              <PlayCircle className="h-4 w-4" />
              검증 실행
            </Button>
            <div className="flex items-center gap-1 border-l pl-2 ml-2">
              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => toggleAll(true)}>펼치기</Button>
              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => toggleAll(false)}>접기</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-6">
            {/* Step 1: Summary */}
            <VerificationSection
              step="Step 1"
              title="월간 열수지 총괄 요약 (Monthly Heat Balance Summary)"
              isExpanded={expandedSteps.step1}
              onToggle={() => toggleStep("step1")}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="text-xs text-orange-600 font-medium mb-1">총 열획득 (<InlineMath math="Q_{sources}" />)</div>
                  <div className="text-xl font-bold text-orange-700">{formatNum(Q_sources, 1)} <span className="text-sm font-normal text-orange-500">kWh</span></div>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-xs text-blue-600 font-medium mb-1">총 열손실 (<InlineMath math="Q_{sinks}" />)</div>
                  <div className="text-xl font-bold text-blue-700">{formatNum(Q_sinks, 1)} <span className="text-sm font-normal text-blue-500">kWh</span></div>
                </div>
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-xs text-emerald-600 font-medium mb-1">이용 효율 (<InlineMath math="\eta" />)</div>
                  <div className="text-xl font-bold text-emerald-700">{formatNum(eta * 100, 1)} <span className="text-sm font-normal text-emerald-500">%</span></div>
                </div>
                <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400 font-medium mb-1">에너지 요구량 (<InlineMath math="Q_{b}" />)</div>
                  <div className="text-xl font-bold text-white">{formatNum(Q_b, 1)} <span className="text-sm font-normal text-slate-400">kWh</span></div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-bold">계산식:</span> <InlineMath math="Q_b = Q_{sinks} - \eta \cdot Q_{sources}" />
                  <br />
                  열수지 균형에 따라 총 열손실에서 유효하게 이용되는 열획득량을 차감하여 최종 에너지 요구량을 산출합니다.
                </p>
              </div>
            </VerificationSection>

            {/* Step 2: Temperatures */}
            <VerificationSection
              step="Step 2"
              title="온도 및 건물 시상수 상세 (Temperatures & Time Constant)"
              isExpanded={expandedSteps.step2}
              onToggle={() => toggleStep("step2")}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">주요 온도 지표</h4>
                  <Table>
                    <TableBody className="text-xs">
                      <TableRow>
                        <TableCell className="font-medium text-slate-500">실내 유효 온도 (<InlineMath math="\theta_{i,eff}" />)</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatNum(Ti_eff, 2)} °C</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-slate-500">월평균 외기 온도 (<InlineMath math="\theta_{e}" />)</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatNum(Te, 2)} °C</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-slate-500">난방 설정 온도 (<InlineMath math="\theta_{set,H}" />)</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatNum(Ti_set, 1)} °C</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">건물 열적 성능</h4>
                  <Table>
                    <TableBody className="text-xs">
                      <TableRow>
                        <TableCell className="font-medium text-slate-500">유효 열용량 (<InlineMath math="C_m" />)</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatNum(currentMonthData.Cm || 0, 0)} Wh/K</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-slate-500">건물 시상수 (<InlineMath math="\tau" />)</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatNum(currentMonthData.tau_h || currentMonthData.tau || 0, 1)} h</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-slate-500">취득/손실 비 (<InlineMath math="\gamma" />)</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatNum(currentMonthData.gamma || 0, 3)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </VerificationSection>

            {/* Step 3: Heat Gains */}
            <VerificationSection
              step="Step 3"
              title="월간 열획득 상세 (Heat Gains)"
              isExpanded={expandedSteps.step3}
              onToggle={() => toggleStep("step3")}
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-orange-600 mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    일사 열취득 상세 (Solar Heat Gains)
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">구분</TableHead>
                        <TableHead className="text-xs text-right">투명 부위 (Transparent)</TableHead>
                        <TableHead className="text-xs text-right">불투명 부위 (Opaque)</TableHead>
                        <TableHead className="text-xs text-right font-bold">합계 (Total)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      <TableRow>
                        <TableCell className="font-medium">사용일 (Usage)</TableCell>
                        <TableCell className="text-right font-mono">{formatNum(currentMonthData.QS_op_transparent || 0, 1)} kWh</TableCell>
                        <TableCell className="text-right font-mono">{formatNum(currentMonthData.QS_op_opaque || 0, 1)} kWh</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatNum((currentMonthData.QS_op_transparent || 0) + (currentMonthData.QS_op_opaque || 0), 1)} kWh</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">비사용일 (Non-Usage)</TableCell>
                        <TableCell className="text-right font-mono">{formatNum(currentMonthData.QS_non_op_transparent || 0, 1)} kWh</TableCell>
                        <TableCell className="text-right font-mono">{formatNum(currentMonthData.QS_non_op_opaque || 0, 1)} kWh</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatNum((currentMonthData.QS_non_op_transparent || 0) + (currentMonthData.QS_non_op_opaque || 0), 1)} kWh</TableCell>
                      </TableRow>
                      <TableRow className="bg-slate-50/50">
                        <TableCell className="font-bold">총 일사취득 (<InlineMath math="Q_S" />)</TableCell>
                        <TableCell className="text-right font-bold text-orange-700 font-mono" colSpan={3}>{formatNum(currentMonthData.QS, 1)} kWh</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-blue-600 mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    내부 발열 상세 (Internal Heat Gains)
                  </h4>
                  <Table>
                    <TableBody className="text-xs">
                      <TableRow>
                        <TableCell className="font-medium text-slate-500">인체 발열 (Occupants, <InlineMath math="Q_{occ}" />)</TableCell>
                        <TableCell className="text-right font-mono">{formatNum(internalGains.Q_occ, 1)} kWh</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-slate-500">조명 발열 (Light, <InlineMath math="Q_{lit}" />)</TableCell>
                        <TableCell className="text-right font-mono">{formatNum(internalGains.Q_lit, 1)} kWh</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-slate-500">기기 발열 (Appliance, <InlineMath math="Q_{app}" />)</TableCell>
                        <TableCell className="text-right font-mono">{formatNum(internalGains.Q_app, 1)} kWh</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-slate-500 italic">설비 보조 가열 (System Gains)</TableCell>
                        <TableCell className="text-right text-slate-400 font-mono">+ {formatNum((systemLosses.heating?.distribution || 0) + (systemLosses.heating?.storage || 0), 1)} kWh</TableCell>
                      </TableRow>
                      <TableRow className="bg-slate-50/50">
                        <TableCell className="font-bold">총 내부발열 (<InlineMath math="Q_I" />)</TableCell>
                        <TableCell className="text-right font-bold text-blue-700 font-mono">{formatNum(currentMonthData.QI, 1)} kWh</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </VerificationSection>

            {/* Step 4: Transmission Losses */}
            <VerificationSection
              step="Step 4"
              title="관류 열손실 상세 (Transmission Losses)"
              isExpanded={expandedSteps.step4}
              onToggle={() => toggleStep("step4")}
            >
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-xs font-bold uppercase">총 관류 열전달계수 (<InlineMath math="H_{tr}" />)</span>
                    <span className="text-lg font-bold font-mono">{formatNum(currentMonthData.H_tr_total || 0, 1)} W/K</span>
                  </div>
                </div>
                <div className="rounded-md border p-0 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-[10px] h-8">부위명 (Surface)</TableHead>
                        <TableHead className="text-right text-[10px] h-8">면적 (m²)</TableHead>
                        <TableHead className="text-right text-[10px] h-8">U-value</TableHead>
                        <TableHead className="text-right text-[10px] h-8">f_x</TableHead>
                        <TableHead className="text-right text-[10px] h-8 font-bold">H_tr (W/K)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-[11px]">
                      {currentMonthData.transmissionBySurface && Object.values(currentMonthData.transmissionBySurface).map((surf: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{surf.name}</TableCell>
                          <TableCell className="text-right font-mono">{formatNum(surf.area, 1)}</TableCell>
                          <TableCell className="text-right font-mono">{formatNum(surf.uValue, 2)}</TableCell>
                          <TableCell className="text-right font-mono">{formatNum(surf.fx || 1.0, 2)}</TableCell>
                          <TableCell className="text-right font-bold font-mono text-blue-600">{formatNum(surf.H_tr, 2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex justify-between items-center text-blue-700">
                  <span className="text-sm font-bold">월간 총 관류 열손실 (<InlineMath math="Q_T" />)</span>
                  <span className="text-lg font-bold font-mono">{formatNum(currentMonthData.QT_heat || 0, 1)} kWh</span>
                </div>
              </div>
            </VerificationSection>

            {/* Step 5: Ventilation Losses */}
            <VerificationSection
              step="Step 5"
              title="환기 열손실 상세 (Ventilation Losses)"
              isExpanded={expandedSteps.step5}
              onToggle={() => toggleStep("step5")}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg border bg-white shadow-sm">
                    <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-tight">침기 (Infiltration)</div>
                    <div className="text-sm font-bold font-mono">{formatNum(currentMonthData.n_inf || 0, 3)} h⁻¹</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-white shadow-sm">
                    <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-tight">창문환기 (Window)</div>
                    <div className="text-sm font-bold font-mono">{formatNum(currentMonthData.n_win || 0, 3)} h⁻¹</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-white shadow-sm">
                    <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-tight">기계환기 (Mechanical)</div>
                    <div className="text-sm font-bold font-mono">{formatNum(currentMonthData.n_mech || 0, 3)} h⁻¹</div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 flex justify-between items-center text-emerald-700">
                  <span className="text-sm font-bold">월간 총 환기 열손실 (<InlineMath math="Q_V" />)</span>
                  <span className="text-lg font-bold font-mono">{formatNum(currentMonthData.QV_heat || 0, 1)} kWh</span>
                </div>
              </div>
            </VerificationSection>

            {/* Verification Results Suite */}
            {verificationResults && (
              <div className="mt-8 pt-8 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-primary" />
                  검증 실행 결과 (Verification Results)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {verificationResults.map((result, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm border-slate-100">
                      <div className="flex items-center gap-3">
                        {result.passed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-rose-500" />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-slate-900">{result.name}</div>
                          <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{result.details}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
