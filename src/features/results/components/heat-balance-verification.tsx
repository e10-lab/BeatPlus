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
  TableFooter,
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
import { Latex } from "@/components/ui/latex";
import {
  ChevronDown,
  ChevronRight,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Users,
  Lightbulb,
  Monitor,
  Settings,
  Percent,
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
  const [balanceMode, setBalanceMode] = useState<"heating" | "cooling">("heating");

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

  const isHeating = balanceMode === "heating";

  const profile = zone?.usageType ? DIN_18599_PROFILES[zone.usageType] : null;

  // 요약 변수 (ISO 13790 / DIN/TS 18599 규정 준화)
  // Gains (Q_gn): Heating(QS + QI), Cooling(QT + QV) -> 냉방 시엔 손실이 곧 소스(외기냉각 등)
  // Losses (Q_ls): Heating(QT + QV), Cooling(QS + QI) -> 냉방 시엔 획득이 곧 부하 원인
  const Q_gains = isHeating 
    ? (currentMonthData.QS + currentMonthData.QI) 
    : (currentMonthData.QT_cool + currentMonthData.QV_cool); 
  const Q_losses = isHeating 
    ? (currentMonthData.QT_heat + currentMonthData.QV_heat) 
    : (currentMonthData.QS + currentMonthData.QI); 
  
  const Q_sources = Q_gains; // 소스 = 획득
  const Q_sinks = Q_losses;   // 싱크 = 손실
  
  const eta = isHeating ? (currentMonthData.eta || 0) : (currentMonthData.eta_C || 0);
  const Q_b = isHeating ? currentMonthData.Q_h_b : currentMonthData.Q_c_b;
  const gamma = isHeating ? (currentMonthData.gamma || 0) : (currentMonthData.gamma_C || 0);
  const alpha_param = isHeating ? (currentMonthData.a_H || 0) : (currentMonthData.a_C || 0);

  // Step 2 변수
  const Ti_eff = isHeating 
    ? (currentMonthData.Theta_i_h || currentMonthData.avg_Ti || 0) 
    : (currentMonthData.Theta_int_C || currentMonthData.avg_Ti_c || 0);
  const Te = currentMonthData.Theta_e || 0;
  
  // 설정 온도 데이터 소스 우선순위: 1. 엔진 결과(heatingLoadDetails), 2. 존 설정값, 3. 프로필 기본값
  const Ti_set = isHeating 
    ? (currentMonthData.heatingLoadDetails?.Theta_int_H ?? zone?.temperatureSetpoints.heating ?? profile?.heatingSetpoint ?? 20)
    : (currentMonthData.Theta_i_c_soll ?? zone?.temperatureSetpoints.cooling ?? profile?.coolingSetpoint ?? 26);

  // Step 3 변수
  // Step 3 변수
  const internalGains = currentMonthData.internalGains || { Q_occ: 0, Q_app: 0, Q_lit: 0, Q_dhw: 0 };
  const systemLosses = currentMonthData.systemLosses || { heating: { generation: 0, distribution: 0, storage: 0 }, cooling: { distribution: 0, storage: 0 } };

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 pb-7">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-3">
              {title || "상세 열수지 분석 (Detailed Heat Balance)"}
              <Tabs 
                value={balanceMode} 
                onValueChange={(v) => setBalanceMode(v as any)}
                className="ml-2"
              >
                <TabsList className="h-8 p-0.5 bg-slate-100">
                  <TabsTrigger value="heating" className="h-7 px-3 text-[11px] data-[state=active]:bg-orange-500 data-[state=active]:text-white">난방 (Heating)</TabsTrigger>
                  <TabsTrigger value="cooling" className="h-7 px-3 text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white">냉방 (Cooling)</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardTitle>
            <CardDescription>
              ISO 13790 / DIN/TS 18599:2025-10 알고리즘에 따른 월간 열획득(Gain)과 열손실(Loss) 상세 검증
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
              title={<>월간 열수지 총괄 요약 (Monthly Heat Balance Summary, <Latex formula="Q_b" />)</>}
              isExpanded={expandedSteps.step1}
              onToggle={() => toggleStep("step1")}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className={cn("p-4 rounded-xl border transition-colors shadow-sm", isHeating ? "bg-orange-50 border-orange-200" : "bg-cyan-50 border-cyan-200")}>
                  <div className={cn("text-xs font-medium mb-1", isHeating ? "text-orange-600" : "text-cyan-600")}>총 {isHeating ? "열획득" : "열획득 (Gains)"} ({isHeating ? <Latex formula="Q_{gn}" /> : <Latex formula="Q_{sources}" />})</div>
                  <div className={cn("text-xl font-bold", isHeating ? "text-orange-700" : "text-cyan-700")}>{formatNum(Q_sources, 1)} <span className={cn("text-sm font-normal", isHeating ? "text-orange-500" : "text-cyan-500")}>kWh</span></div>
                </div>
                <div className={cn("p-4 rounded-xl border transition-colors shadow-sm", isHeating ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200")}>
                  <div className={cn("text-xs font-medium mb-1", isHeating ? "text-blue-600" : "text-amber-600")}>총 {isHeating ? "열손실" : "열손실 (Losses)"} ({isHeating ? <Latex formula="Q_{ls}" /> : <Latex formula="Q_{sinks}" />})</div>
                  <div className={cn("text-xl font-bold", isHeating ? "text-blue-700" : "text-amber-700")}>{formatNum(Q_sinks, 1)} <span className={cn("text-sm font-normal", isHeating ? "text-blue-500" : "text-amber-500")}>kWh</span></div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm">
                  <div className="text-xs text-emerald-600 font-medium mb-1">이용 효율 (<Latex formula="\eta" />)</div>
                  <div className="text-xl font-bold text-emerald-700">{formatNum(eta * 100, 2)} <span className="text-sm font-normal text-emerald-500">%</span></div>
                </div>
                <div className={cn("p-4 rounded-xl border transition-colors shadow-sm", isHeating ? "bg-slate-900 border-slate-800" : "bg-blue-950 border-blue-900")}>
                  <div className="text-xs text-slate-400 font-medium mb-1">{isHeating ? "난방" : "냉방"} 에너지 요구량 (<Latex formula="Q_{b}" />)</div>
                  <div className="text-xl font-bold text-white">{formatNum(Q_b, 1)} <span className="text-sm font-normal text-slate-400">kWh</span></div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <p className="text-xs text-slate-600 leading-relaxed italic border-l-2 pl-3 py-1">
                    <span className="font-bold not-italic">계산식:</span> {isHeating ? (
                      <Latex formula="Q_b = Q_{losses} - \eta \cdot Q_{gains}" />
                    ) : (
                      <Latex formula="Q_b = (1 - \eta) \cdot Q_{gains}" />
                    )}
                    <br />
                    <span className="text-[10px] text-slate-400 not-italic">
                      * {isHeating ? (
                        <>
                          <Latex formula="Q_{gains} = Q_S + Q_I" /> (Gains), 
                          <br />
                          <Latex formula="Q_{losses} = Q_T + Q_V" /> (Losses)
                        </>
                      ) : (
                        <>
                          <Latex formula="Q_{gains} = Q_{sol} + Q_{int}" /> (Gains), 
                          <br />
                          <Latex formula="Q_{losses} = Q_T + Q_V" /> (Losses)
                          <br />
                          <span className="text-blue-500 font-bold">* 냉방시 Q_b는 가동일 비율({formatNum((profile?.annualUsageDays || 0) / 365, 3)})이 반영된 결과입니다.</span>
                        </>
                      )}
                    </span>
                  </p>
                  <div className="text-[10px] text-slate-500 border-l-2 pl-3 py-1 flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span className="font-bold">취득/손실비 (<Latex formula="\gamma" />)</span>
                      <span className="font-mono">{formatNum(gamma, 3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">이용효율 계수 (<Latex formula="a" />)</span>
                      <span className="font-mono">{formatNum(alpha_param, 2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">건물 시상수 (<Latex formula="\tau" />)</span>
                      <span className="font-mono">{formatNum(isHeating ? (currentMonthData.tau_h || currentMonthData.tau || 0) : (currentMonthData.tau_c || 0), 1)} h</span>
                    </div>
                  </div>
                </div>
              </div>
            </VerificationSection>

            {/* Step 2: Temperatures */}
            <VerificationSection
              step="Step 2"
              title={<>온도 및 건물 시상수 상세 (Temperatures & Time Constant)</>}
              isExpanded={expandedSteps.step2}
              onToggle={() => toggleStep("step2")}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">주요 온도 지표</h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="text-[10px] h-9 font-bold text-slate-600">온도 항목 (Parameters)</TableHead>
                          <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">값 (Value)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        <TableRow className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2.5 font-medium text-slate-700">실내 유효 온도 (<Latex formula="\theta_{i,eff}" />)</TableCell>
                          <TableCell className="py-2.5 text-right font-bold font-mono">{formatNum(Ti_eff, 2)} °C</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2.5 font-medium text-slate-700">월평균 외기 온도 (<Latex formula="\theta_{e}" />)</TableCell>
                          <TableCell className="py-2.5 text-right font-bold font-mono">{formatNum(Te, 2)} °C</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2.5 font-medium text-slate-700">{isHeating ? "난방" : "냉방"} 설정 온도 ({isHeating ? <Latex formula="\theta_{set,H}" /> : <Latex formula="\theta_{set,C}" />})</TableCell>
                          <TableCell className="py-2.5 text-right font-bold font-mono">{formatNum(Ti_set, 1)} °C</TableCell>
                        </TableRow>
                        {currentMonthData.f_NA !== undefined && (
                          <TableRow className="hover:bg-slate-50/30 transition-colors">
                            <TableCell className="py-2.5 font-medium text-slate-700">야간 설정 저감 계수 (<Latex formula="f_{NA}" />)</TableCell>
                            <TableCell className="py-2.5 text-right font-mono">{formatNum(currentMonthData.f_NA, 3)}</TableCell>
                          </TableRow>
                        )}
                        {currentMonthData.f_we !== undefined && (
                          <TableRow className="hover:bg-slate-50/30 transition-colors">
                            <TableCell className="py-2.5 font-medium text-slate-700">주말 운전 보정 계수 (<Latex formula="f_{we}" />)</TableCell>
                            <TableCell className="py-2.5 text-right font-mono">{formatNum(currentMonthData.f_we, 3)}</TableCell>
                          </TableRow>
                        )}
                        {currentMonthData.Delta_theta_i_NA !== undefined && currentMonthData.Delta_theta_i_NA !== 0 && (
                          <TableRow className="hover:bg-slate-50/30 transition-colors">
                            <TableCell className="py-2.5 font-medium text-slate-700 italic">야간 온도 저감폭 (<Latex formula="\Delta\theta_{i,NA}" />)</TableCell>
                            <TableCell className="py-2.5 text-right font-mono">-{formatNum(currentMonthData.Delta_theta_i_NA, 2)} K</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">건물 열적 성능</h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="text-[10px] h-9 font-bold text-slate-600">성능 항목 (Performance)</TableHead>
                          <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">값 (Value)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        <TableRow className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2.5 font-medium text-slate-700">
                            <div className="flex items-baseline gap-2">
                              <span>유효 열용량 (<Latex formula="C_m" />)</span>
                              <span className="text-[10px] text-slate-400 font-normal border-l pl-2"><Latex formula="C_m = c_{wirk} \cdot A" /></span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-bold font-mono">{formatNum(currentMonthData.Cm || 0, 0)} Wh/K</TableCell>
                        </TableRow>
                        {currentMonthData.f_adapt !== undefined && (
                          <TableRow className="hover:bg-slate-50/30 transition-colors">
                            <TableCell className="py-2.5 font-medium text-slate-700">운전 조건 적응 계수 (<Latex formula="f_{adapt}" />)</TableCell>
                            <TableCell className="py-2.5 text-right font-mono">{formatNum(currentMonthData.f_adapt, 3)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </VerificationSection>

            {/* Step 3: Solar Heat Gains */}
            <VerificationSection
              step="Step 3"
              title={<>일사 열취득 상세 (Solar Heat Gains)</>}
              isExpanded={expandedSteps.step3}
              onToggle={() => toggleStep("step3")}
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-orange-600 mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    일사 열취득 상세 (Solar Heat Gains)
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="text-[10px] h-9 font-bold text-slate-600">구분 (Category)</TableHead>
                          <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">투명 부위 (Transparent)</TableHead>
                          <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">불투명 부위 (Opaque)</TableHead>
                          <TableHead className="text-[10px] h-9 text-right font-bold text-slate-900 bg-slate-50/50">합계 (Total)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        <TableRow className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2.5 font-medium text-slate-700">
                            사용일 (Usage) <span className="ml-1 text-[10px] font-normal text-slate-400">({formatNum(currentMonthData.d_nutz || 0, 1)}일)</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-mono">{formatNum(currentMonthData.QS_op_transparent || 0, 1)} kWh</TableCell>
                          <TableCell className="py-2.5 text-right font-mono">{formatNum(currentMonthData.QS_op_opaque || 0, 1)} kWh</TableCell>
                          <TableCell className="py-2.5 text-right font-bold font-mono bg-slate-50/30">{formatNum((currentMonthData.QS_op_transparent || 0) + (currentMonthData.QS_op_opaque || 0), 1)} kWh</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2.5 font-medium text-slate-700">
                            비사용일 (Non-Usage) <span className="ml-1 text-[10px] font-normal text-slate-400">({formatNum(currentMonthData.d_we || 0, 1)}일)</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-mono">{formatNum(currentMonthData.QS_non_op_transparent || 0, 1)} kWh</TableCell>
                          <TableCell className="py-2.5 text-right font-mono">{formatNum(currentMonthData.QS_non_op_opaque || 0, 1)} kWh</TableCell>
                          <TableCell className="py-2.5 text-right font-bold font-mono bg-slate-50/30">{formatNum((currentMonthData.QS_non_op_transparent || 0) + (currentMonthData.QS_non_op_opaque || 0), 1)} kWh</TableCell>
                        </TableRow>
                        <TableRow className="bg-slate-100/30 border-t-2">
                          <TableCell className="py-3 font-bold text-slate-900">총 일사취득 (<Latex formula="Q_S" />)</TableCell>
                          <TableCell className="py-3 text-right font-bold text-orange-700 font-mono text-base" colSpan={3}>{formatNum(currentMonthData.QS, 1)} kWh</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="mt-8 space-y-8">
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-sm rotate-45" />
                      투명 부위 상세 산정 근거 (Transparent Solar Gain Details)
                      <span className="text-[10px] font-bold text-slate-400 ml-auto italic font-mono tracking-tight bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                        <Latex formula="Q = A \cdot I \cdot g_{eff} \cdot F_g" />
                      </span>
                    </h5>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="text-[10px] h-9 font-bold text-slate-600">부재명 (Assembly)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">면적 (<Latex formula="A" />)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">일사량 (<Latex formula="I" />)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600 whitespace-nowrap">효율 (<Latex formula="g_{eff}" />)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">유리 (<Latex formula="F_g" />)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-900 bg-slate-50/50 whitespace-nowrap">취득량 (<Latex formula="Q" />)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-[10px]">
                          {(Object.values(currentMonthData.solarData || {}) as any[]).filter(s => s.isTransparent).map((s, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/30 transition-colors">
                              <TableCell className="py-2.5 font-medium text-slate-700">{s.name}</TableCell>
                              <TableCell className="py-2.5 text-right font-mono text-slate-600">{formatNum(s.area, 1)} m²</TableCell>
                              <TableCell className="py-2.5 text-right font-mono text-slate-500">{formatNum(s.I_sol_kwh, 1)}</TableCell>
                              <TableCell className="py-2.5 text-right font-mono font-bold text-blue-600">{formatNum(s.shgc_eff, 3)}</TableCell>
                              <TableCell className="py-2.5 text-right font-mono text-slate-400">{formatNum(s.f_glass || 0.7, 2)}</TableCell>
                              <TableCell className="py-2.5 text-right font-bold font-mono text-slate-900 bg-slate-50/30">{formatNum(s.Q_sol_kwh, 1)} kWh</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="bg-slate-50/50">
                            <TableCell className="py-2 text-[10px] font-bold text-slate-900">합계 (Total)</TableCell>
                            <TableCell className="py-2 text-right font-mono text-slate-900">{formatNum((Object.values(currentMonthData.solarData || {}) as any[]).filter(s => s.isTransparent).reduce((sum, s) => sum + s.area, 0), 1)} m²</TableCell>
                            <TableCell className="py-2" colSpan={3}></TableCell>
                            <TableCell className="py-2 text-right font-bold font-mono text-slate-900 bg-slate-50/30">{formatNum((currentMonthData.QS_op_transparent || 0) + (currentMonthData.QS_non_op_transparent || 0), 1)} kWh</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-[11px] font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-slate-600 rounded-sm rotate-45" />
                      불투명 부위 상세 산정 근거 (Opaque Solar Gain Details)
                      <span className="text-[10px] font-bold text-slate-400 ml-auto italic font-mono tracking-tight bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                        <Latex formula="Q = A \cdot U \cdot R_{se} \cdot (\alpha \cdot I - Q_{rad})" />
                      </span>
                    </h5>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="text-[10px] h-9 font-bold text-slate-600">부재명 (Assembly)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">면적 (<Latex formula="A" />)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">일사량 (<Latex formula="I" />)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600"><Latex formula="U" /></TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">저항(<Latex formula="R_{se}" />)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">흡수(<Latex formula="\alpha" />)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-600">방사(<Latex formula="Q_{rad}" />)</TableHead>
                            <TableHead className="text-[10px] h-9 text-right font-bold text-slate-900 bg-slate-50/50 whitespace-nowrap">취득량 (<Latex formula="Q" />)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-[10px]">
                          {(Object.values(currentMonthData.solarData || {}) as any[]).filter(s => !s.isTransparent).map((s, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/30 transition-colors">
                              <TableCell className="py-2.5 font-medium text-slate-700">{s.name}</TableCell>
                              <TableCell className="py-2.5 text-right font-mono text-slate-600">{formatNum(s.area, 1)} m²</TableCell>
                              <TableCell className="py-2.5 text-right font-mono text-slate-500">{formatNum(s.I_sol_kwh, 0)}</TableCell>
                              <TableCell className="py-2.5 text-right font-mono text-slate-600">{formatNum(s.u_value, 3)}</TableCell>
                              <TableCell className="py-2.5 text-right font-mono text-slate-400">{formatNum(s.r_se || 0.04, 3)}</TableCell>
                              <TableCell className="py-2.5 text-right font-mono text-slate-500">{formatNum(s.alpha, 2)}</TableCell>
                              <TableCell className="py-2.5 text-right font-mono text-slate-400">{formatNum(s.q_rad_loss, 1)}</TableCell>
                              <TableCell className="py-2.5 text-right font-bold font-mono text-slate-900 bg-slate-50/30">{formatNum(s.Q_sol_kwh, 1)} kWh</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="bg-slate-50/50">
                            <TableCell className="py-2 text-[10px] font-bold text-slate-900">합계 (Total)</TableCell>
                            <TableCell className="py-2 text-right font-mono text-slate-900">{formatNum((Object.values(currentMonthData.solarData || {}) as any[]).filter(s => !s.isTransparent).reduce((sum, s) => sum + s.area, 0), 1)} m²</TableCell>
                            <TableCell className="py-2" colSpan={5}></TableCell>
                            <TableCell className="py-2 text-right font-bold font-mono text-slate-900 bg-slate-50/30">{formatNum((currentMonthData.QS_op_opaque || 0) + (currentMonthData.QS_non_op_opaque || 0), 1)} kWh</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            </VerificationSection>

            <VerificationSection
              step="Step 4"
              title={<>내부 열획득 상세 (Internal Heat Gains)</>}
              isExpanded={expandedSteps.step4}
              onToggle={() => toggleStep("step4")}
            >
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-500 text-sm">
                  상세 항목 데이터는 총괄 요약(Step 1)에 합산되어 반영되어 있습니다.
                </div>
              </div>
            </VerificationSection>

            {/* Step 5: Transmission Losses */}
            <VerificationSection
              step="Step 5"
              title={<>관류 열손실 상세 (Transmission Losses)</>}
              isExpanded={expandedSteps.step5}
              onToggle={() => toggleStep("step5")}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex justify-between items-center text-slate-700 mb-2">
                      <span className="text-xs font-bold uppercase tracking-tight">난방 기준 관류 계수 (<Latex formula="H_{tr}" />)</span>
                      <span className="text-sm font-bold font-mono">{formatNum(currentMonthData.H_tr_total || 0, 1)} W/K</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 text-[10px] font-mono">
                      <span>(<Latex formula="D" />:{formatNum(currentMonthData.H_tr_D || 0, 1)}, <Latex formula="g" />:{formatNum(currentMonthData.H_tr_g || 0, 1)}, <Latex formula="u" />:{formatNum(currentMonthData.H_tr_u || 0, 1)}, <Latex formula="WB" />:{formatNum(currentMonthData.H_tr_WB || 0, 1)})</span>
                    </div>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="text-[10px] h-9 font-bold text-slate-600">부위명 (Surface)</TableHead>
                        <TableHead className="text-right text-[10px] h-9 font-bold text-slate-600">면적 (<Latex formula="A" />)</TableHead>
                        <TableHead className="text-right text-[10px] h-9 font-bold text-slate-600"><Latex formula="U" /></TableHead>
                        <TableHead className="text-right text-[10px] h-9 font-bold text-slate-600"><Latex formula="f_x" /></TableHead>
                        <TableHead className="text-right text-[10px] h-9 font-bold text-slate-400 italic"><Latex formula="\Delta U_{WB}" /></TableHead>
                        <TableHead className="text-right text-[10px] h-9 font-bold text-slate-600"><Latex formula="H_{surf}" /></TableHead>
                        <TableHead className="text-right text-[10px] h-9 font-bold text-slate-400"><Latex formula="H_{bridge}" /></TableHead>
                        <TableHead className="text-right text-[10px] h-9 font-bold text-slate-900 bg-slate-50/50"><Latex formula="H_{tr}" /> (W/K)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-[11px]">
                      {currentMonthData.transmissionBySurface && Object.values(currentMonthData.transmissionBySurface).map((surf: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2.5 font-medium text-slate-700">{surf.name}</TableCell>
                          <TableCell className="py-2.5 text-right font-mono text-slate-600">{formatNum(surf.area, 1)}</TableCell>
                          <TableCell className="py-2.5 text-right font-mono text-slate-600">{formatNum(surf.uValue, 3)}</TableCell>
                          <TableCell className="py-2.5 text-right font-mono text-slate-500">{formatNum(surf.fx || 1.0, 3)}</TableCell>
                          <TableCell className="py-2.5 text-right font-mono text-slate-400 italic">+{formatNum(surf.delta_U_WB || 0, 3)}</TableCell>
                          <TableCell className="py-2.5 text-right font-mono text-slate-500">{formatNum(surf.H_tr, 1)}</TableCell>
                          <TableCell className="py-2.5 text-right font-mono text-slate-400">{formatNum(surf.H_bridge || 0, 1)}</TableCell>
                          <TableCell className="py-2.5 text-right font-bold font-mono text-blue-600 bg-slate-50/30">{formatNum((surf.H_tr || 0) + (surf.H_bridge || 0), 2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="flex justify-between items-center text-blue-700">
                      <span className="text-[10px] font-bold uppercase">사용일 관류 (<Latex formula="Q_{T,op}" />)</span>
                      <span className="text-sm font-bold font-mono">{formatNum(currentMonthData.QT_op || 0, 1)} kWh</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-[10px] font-bold uppercase">비사용일 관류 (<Latex formula="Q_{T,non\_op}" />)</span>
                      <span className="text-sm font-bold font-mono">{formatNum(currentMonthData.QT_non_op || 0, 1)} kWh</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-blue-100 border border-blue-200 flex justify-between items-center text-blue-800">
                  <span className="text-sm font-bold">월간 총 관류 {isHeating ? "열손실" : "열취득"} (<Latex formula={isHeating ? "Q_T" : "Q_{T,cool}"} />)</span>
                  <span className="text-lg font-bold font-mono">{formatNum(isHeating ? (currentMonthData.QT_heat || 0) : (currentMonthData.QT_cool || 0), 1)} kWh</span>
                </div>
              </div>
            </VerificationSection>

            {/* Step 6: Ventilation Losses */}
            <VerificationSection
              step="Step 6"
              title={<>환기 열손실 상세 (Ventilation Losses)</>}
              isExpanded={expandedSteps.step6}
              onToggle={() => toggleStep("step6")}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  {currentMonthData.H_ve_total !== undefined && (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex justify-between items-center text-slate-700 mb-2">
                        <span className="text-xs font-bold uppercase tracking-tight">환기 열전달계수 (<Latex formula="H_{ve}" />)</span>
                        <span className="text-sm font-bold font-mono">{formatNum(currentMonthData.H_ve_total || 0, 1)} W/K</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500 text-[10px] font-mono">
                        <span>(inf:{formatNum(currentMonthData.H_ve_inf || 0, 1)}, win:{formatNum(currentMonthData.H_ve_win || 0, 1)}, mech:{formatNum(currentMonthData.H_ve_mech || 0, 1)})</span>
                      </div>
                    </div>
                  )}
                </div>


                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">환기 산정 주요 인자 (Ventilation Inputs)</h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                          <TableHead className="text-[9px] h-7 font-bold text-slate-600"><Latex formula="A_{NGF}" /> (m²)</TableHead>
                          <TableHead className="text-right text-[9px] h-7 font-bold text-slate-600"><Latex formula="V" /> (m³)</TableHead>
                          <TableHead className="text-right text-[9px] h-7 font-bold text-slate-600"><Latex formula="n_{50}" /> (1/h)</TableHead>
                          <TableHead className="text-right text-[9px] h-7 font-bold text-slate-600"><Latex formula="\eta_{rec}" /> (%)</TableHead>
                          <TableHead className="text-right text-[9px] h-7 font-bold text-slate-600"><Latex formula="t_{nutz}" /> (h/d)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-[10px]">
                        <TableRow>
                          <TableCell className="py-2 font-mono">{formatNum(currentMonthData.A_NGF || 0, 1)}</TableCell>
                          <TableCell className="py-2 text-right font-mono">{formatNum(currentMonthData.V_net || 0, 1)}</TableCell>
                          <TableCell className="py-2 text-right font-mono">{formatNum(currentMonthData.n50 || 0, 2)}</TableCell>
                          <TableCell className="py-2 text-right font-mono">{formatNum((currentMonthData.heatRecoveryEff || 0) * 100, 0)}%</TableCell>
                          <TableCell className="py-2 text-right font-mono">{formatNum(currentMonthData.t_nutz || 0, 1)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">환기 성분별 상세 (Ventilation Component Breakdown)</h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                          <TableHead className="text-[9px] h-7 font-bold text-slate-600">성분 (Component)</TableHead>
                          <TableHead className="text-right text-[9px] h-7 font-bold text-slate-600">환기횟수 (<Latex formula="n" />) [1/h]</TableHead>
                          <TableHead className="text-right text-[9px] h-7 font-bold text-slate-900 bg-slate-50/30">계수 (<Latex formula="H_{ve}" />) [W/K]</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-[10px]">
                        <TableRow className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2 font-medium text-slate-700">침기 (Infiltration)</TableCell>
                          <TableCell className="py-2 text-right font-mono text-slate-600">{formatNum(currentMonthData.n_inf || 0, 3)}</TableCell>
                          <TableCell className="py-2 text-right font-bold font-mono text-amber-600 bg-slate-50/10 border-l">{formatNum(currentMonthData.H_ve_inf || 0, 2)}</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2 font-medium text-slate-700">창문환기 (Window)</TableCell>
                          <TableCell className="py-2 text-right font-mono text-slate-600">{formatNum(currentMonthData.n_win || 0, 3)}</TableCell>
                          <TableCell className="py-2 text-right font-bold font-mono text-sky-600 bg-slate-50/10 border-l">{formatNum(currentMonthData.H_ve_win || 0, 2)}</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="py-2 font-medium text-slate-700">기계환기 (Mechanical)</TableCell>
                          <TableCell className="py-2 text-right font-mono text-slate-600">{formatNum(currentMonthData.n_mech || 0, 3)}</TableCell>
                          <TableCell className="py-2 text-right font-bold font-mono text-violet-600 bg-slate-50/10 border-l">{formatNum(currentMonthData.H_ve_mech || 0, 2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                    <div className="flex justify-between items-center text-emerald-700">
                      <span className="text-[10px] font-bold uppercase">사용일 환기 (<Latex formula="Q_{V,op}" />)</span>
                      <span className="text-sm font-bold font-mono">{formatNum(currentMonthData.QV_op || 0, 1)} kWh</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-[10px] font-bold uppercase">비사용일 환기 (<Latex formula="Q_{V,non\_op}" />)</span>
                      <span className="text-sm font-bold font-mono">{formatNum(currentMonthData.QV_non_op || 0, 1)} kWh</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-emerald-100 border border-emerald-200 flex justify-between items-center text-emerald-800">
                  <span className="text-sm font-bold">월간 총 환기 {isHeating ? "열손실" : "열취득"} (<Latex formula={isHeating ? "Q_V" : "Q_{V,cool}"} />)</span>
                  <span className="text-lg font-bold font-mono">{formatNum(isHeating ? (currentMonthData.QV_heat || 0) : (currentMonthData.QV_cool || 0), 1)} kWh</span>
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
