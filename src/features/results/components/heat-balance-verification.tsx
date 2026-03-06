"use client";

import React, { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";
import {
  Info,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Sun,
  Zap,
  Trash2,
  Wind,
} from "lucide-react";
import { Zone } from "@/types/project";
import { DIN_18599_PROFILES } from "@/lib/din-18599-profiles";
import { cn } from "@/lib/utils";
import { runVerifications, VerificationResult } from "../services/verification-service";
import { CheckCircle2, XCircle, PlayCircle } from "lucide-react";

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
  selectedMonth,
  selectedIterationStep,
  onMonthChange,
  onIterationSelect,
}: HeatBalanceVerificationProps) {
  const [balanceMode, setBalanceMode] = useState<"heating" | "cooling">(
    "heating",
  );
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({
    step1: true,
    step2: true,
    step3: true,
  });
  const toggleStep = (step: string) => {
    setExpandedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const [verificationResults, setVerificationResults] = useState<VerificationResult[] | null>(null);

  const handleRunVerification = () => {
    const results = runVerifications();
    setVerificationResults(results);
  };

  const toggleAll = (expanded: boolean) => {
    setExpandedSteps({
      step1: expanded,
      step2: expanded,
      step3: expanded,
    });
  };

  const profile = zone?.usageType
    ? DIN_18599_PROFILES[zone.usageType] || DIN_18599_PROFILES["1_office"]
    : DIN_18599_PROFILES["1_office"];
  const floorArea = zone?.area || 1;

  if (!data || data.length === 0)
    return (
      <div className="p-4 text-center text-muted-foreground">
        데이터가 없습니다.
      </div>
    );

  const currentMonthDataRaw =
    data.find((m) => m.month === selectedMonth) || data[0];

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
    eta_c: selectedLog.details.eta_c,
    gamma: selectedLog.details.gamma_h,
    gamma_c: selectedLog.details.gamma_c,
  } : currentMonthDataRaw;

  // Derived Solar Data
  const solarDetails = Object.values(currentMonthData.solarData || {});
  const trDetails = solarDetails.filter((d: any) => d.isTransparent);
  const opDetails = solarDetails.filter((d: any) => !d.isTransparent);

  const QS_tr_total = trDetails.reduce((acc: number, d: any) => acc + (d.Q_sol_kwh || 0), 0);
  const QS_op_total = opDetails.reduce((acc: number, d: any) => acc + (d.Q_sol_kwh || 0), 0);

  // Approximate Op/Non-Op split based on days ratio
  const totalDays = (currentMonthData.d_nutz || 0) + (currentMonthData.d_we || 0);
  const opRatio = totalDays > 0 ? (currentMonthData.d_nutz || 0) / totalDays : 1;

  const QS_tr_op = QS_tr_total * opRatio;
  const QS_opak_op = QS_op_total * opRatio;
  const QS_sol_op_total = (QS_tr_total + QS_op_total) * opRatio;

  const QS_tr_non_op = QS_tr_total * (1 - opRatio);
  const QS_opak_non_op = QS_op_total * (1 - opRatio);
  const QS_sol_non_op_total = (QS_tr_total + QS_op_total) * (1 - opRatio);

  const totalHours = new Date(2023, selectedMonth, 0).getDate() * 24;

  const isHeating = balanceMode === "heating";
  const Ti_eff = isHeating
    ? currentMonthData.Theta_i_h
    : currentMonthData.avg_Ti_c;
  const Te = currentMonthData.Theta_e || 0;
  const isTSource = Te > (Ti_eff || 0);
  const isVSource = isTSource;

  // 성분별 합계 (열 흐름 방향에 따라 동적으로 계산)
  const QT_val = isHeating
    ? currentMonthData.QT_heat
    : currentMonthData.QT_cool;
  const QV_val = isHeating
    ? currentMonthData.QV_heat
    : currentMonthData.QV_cool;

  const Q_sources =
    currentMonthData.QS +
    currentMonthData.QI +
    (isTSource ? QT_val : 0) +
    (isVSource ? QV_val : 0);
  const Q_sinks = (!isTSource ? QT_val : 0) + (!isVSource ? QV_val : 0);

  const eta = isHeating ? currentMonthData.eta : currentMonthData.eta_c;
  const Q_b = isHeating ? currentMonthData.Q_h_b : currentMonthData.Q_c_b;

  const formatNum = (val: number | undefined | null, decimals = 1) =>
    val != null ? val.toFixed(decimals) : "-";

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div>
            <CardTitle>
              {title || "열수지 상세 분석 (Heat Balance Analysis)"}
            </CardTitle>
            <CardDescription>
              월간 난방/냉방 부하 계산을 위한 상세 열손실 및 열획득 성분 분석
              (kWh/월)
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <Tabs
              value={balanceMode}
              onValueChange={(v) => setBalanceMode(v as "heating" | "cooling")}
              className="w-[180px]"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="heating">난방 (Heat)</TabsTrigger>
                <TabsTrigger value="cooling">냉방 (Cool)</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-4 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-700">조회 월:</span>
                <Select value={selectedMonth.toString()} onValueChange={(v) => onMonthChange(parseInt(v))}>
                  <SelectTrigger className="w-[100px] bg-white h-8 text-xs">
                    <SelectValue placeholder="월 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.map((m) => (
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

            {/* Verification Button */}
            <button
              onClick={handleRunVerification}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors text-xs font-bold"
              title="Run automated verification suite"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              검증 실행
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Verification Results Area */}
          {verificationResults && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 overflow-hidden mb-6">
              <div className="px-4 py-3 bg-indigo-100/50 border-b border-indigo-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  자동 검증 결과 (Automated Verification Results)
                </h3>
                <button
                  onClick={() => setVerificationResults(null)}
                  className="text-xs text-indigo-500 hover:text-indigo-700"
                >
                  닫기
                </button>
              </div>
              <div className="p-4 space-y-2">
                {verificationResults.map((res, idx) => (
                  <div key={idx} className={cn("flex items-start gap-3 p-3 rounded border text-sm", res.passed ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200")}>
                    {res.passed ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <div className={cn("font-bold", res.passed ? "text-green-800" : "text-red-800")}>{res.name}</div>
                      <div className="text-slate-600 mt-1 text-xs whitespace-pre-wrap">{res.details}</div>
                      {!res.passed && res.expected && (
                        <div className="mt-1 text-xs font-mono bg-white/50 px-2 py-1 rounded inline-block text-red-700 border border-red-100">
                          Expected: {res.expected}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 1. 전체 열수지 요약 */}
          <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
            <button
              onClick={() => toggleStep("step1")}
              className={cn(
                "w-full flex items-center justify-between p-4 transition-colors text-left",
                expandedSteps.step1
                  ? "bg-slate-50 border-b"
                  : "hover:bg-slate-50/50",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary p-1 rounded font-mono text-sm">
                  Step 1
                </span>
                <h3 className="text-lg font-semibold text-slate-700">
                  1) 월간 {isHeating ? "난방" : "냉방"} 열수지 요약 (
                  {isHeating ? "Heating" : "Cooling"} Balance)
                </h3>
              </div>
              {expandedSteps.step1 ? (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-400" />
              )}
            </button>

            {expandedSteps.step1 && (
              <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-orange-50 border border-orange-100 flex-1">
                    <div className="text-xs text-orange-600 font-medium mb-1">
                      총 열획득 (Total Gains / Quellen)
                    </div>
                    <div className="text-2xl font-bold text-orange-700">
                      {formatNum(Q_sources)}{" "}
                      <span className="text-sm font-normal">kWh/월</span>
                    </div>
                    <InlineMath
                      math={
                        isTSource
                          ? "Q_{gain} = Q_S + Q_I + Q_T + Q_V"
                          : "Q_{gain} = Q_S + Q_I"
                      }
                    />
                  </div>
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex-1">
                    <div className="text-xs text-blue-600 font-medium mb-1">
                      총 열손실 (Total Losses / Senken)
                    </div>
                    <div className="text-2xl font-bold text-blue-700">
                      {formatNum(Q_sinks)}{" "}
                      <span className="text-sm font-normal">kWh/월</span>
                    </div>
                    <InlineMath
                      math={
                        !isTSource ? "Q_{loss} = Q_T + Q_V" : "Q_{loss} = 0"
                      }
                    />
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium mb-1">
                      이용 효율 (Ausnutzungsgrad)
                    </div>
                    <div className="text-2xl font-bold">
                      {formatNum(eta, 3)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Utilization Factor (<InlineMath math="\eta" />)
                    </div>
                  </div>
                  <div
                    className={`p-4 rounded-lg border italic ${isHeating ? "bg-red-50 border-red-100" : "bg-cyan-50 border-cyan-100"}`}
                  >
                    <div
                      className={`text-xs font-bold mb-1 ${isHeating ? "text-red-600" : "text-cyan-700"}`}
                    >
                      {isHeating ? "난방" : "냉방"} 에너지 요구량 (
                      <InlineMath math={isHeating ? "Q_{h,b}" : "Q_{c,b}"} />)
                    </div>
                    <div className="text-2xl font-bold">
                      {formatNum(Q_b)}{" "}
                      <span className="text-sm font-normal">kWh/월</span>
                    </div>
                    <div
                      className={`text-xs mt-1 ${isHeating ? "text-red-400" : "text-cyan-500"}`}
                    >
                      <InlineMath
                        math={
                          isHeating
                            ? "Q_{h,b} = \\max(0, Q_{loss} - \\eta \\cdot Q_{gain})"
                            : "Q_{c,b} = (1 - \\eta) \\cdot Q_{gain}"
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="h-px bg-slate-200 my-8" />

          {/* 동적 섹션: Step 2 (열획득) 및 Step 3 (열손실) */}
          <div className="grid grid-cols-1 gap-12">
            {/* A. 열 공급 성분 (열획득) */}
            <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
              <button
                onClick={() => toggleStep("step2")}
                className={cn(
                  "w-full flex items-center justify-between p-4 transition-colors text-left",
                  expandedSteps.step2
                    ? "bg-orange-50/50 border-b border-orange-100"
                    : "hover:bg-orange-50/30",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="bg-orange-100 text-orange-700 p-1 rounded font-mono text-sm">
                    Step 2
                  </span>
                  <h3 className="text-lg font-semibold text-orange-700">
                    월간 열획득 성분 (Monthly Heat Gains / Quellen)
                  </h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-orange-700 font-bold text-sm">
                    {formatNum(Q_sources, 1)} kWh/월
                  </div>
                  {expandedSteps.step2 ? (
                    <ChevronDown className="h-5 w-5 text-orange-300" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-orange-300" />
                  )}
                </div>
              </button>

              {expandedSteps.step2 && (
                <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex flex-col gap-10">
                    <div className="space-y-6">
                      <h4 className="text-base font-bold text-orange-800 border-b border-orange-100 pb-2 mb-2">
                        2) 일사 열획득 상세 (Solar - <InlineMath math="Q_S" />)
                      </h4>

                      {/* 2.1) 투명부위 */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <h5 className="text-sm font-bold text-orange-800">
                            2.1) 투명부위 일사 열획득 상세 (Transparent Solar
                            Gains)
                          </h5>
                          <span className="text-xs text-orange-600/70 italic">
                            *{" "}
                            <InlineMath math="Q_{S,tr} = F_g \cdot A \cdot (F_s \cdot F_w \cdot F_v \cdot g) \cdot I_S" />
                          </span>
                        </div>
                        <div className="rounded-md border border-orange-200 overflow-hidden">
                          <Table className="text-[11px]">
                            <TableHeader className="bg-orange-50/50">
                              <TableRow>
                                <TableHead>부위 (Surface)</TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="A" /> (m²)
                                </TableHead>
                                <TableHead className="text-right">
                                  방위 (Ori.)
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="g" />
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="F_w" />
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="F_s" />
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="F_v" />
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="I_S" /> (kWh/m²)
                                </TableHead>
                                <TableHead className="text-right font-bold text-orange-700 bg-orange-100/30">
                                  <InlineMath math="Q_S" /> (kWh/월)
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {trDetails.length > 0 ? (
                                trDetails.map(
                                  (detail: any, idx) => (
                                    <TableRow key={`tr-${idx}`}>
                                      <TableCell className="font-medium">
                                        {detail.name}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.area, 2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {detail.orientation}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.shgc, 2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.f_w, 2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.f_s, 2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.f_v, 2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.I_sol_kwh, 1)}
                                      </TableCell>
                                      <TableCell className="text-right font-bold text-orange-600">
                                        {formatNum(detail.Q_sol_kwh, 1)}
                                      </TableCell>
                                    </TableRow>
                                  ),
                                )
                              ) : (
                                <TableRow>
                                  <TableCell
                                    colSpan={9}
                                    className="text-center py-4 text-muted-foreground font-sans text-xs"
                                  >
                                    투명부재 데이터 없음
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* 2.2) 불투명부위 */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <h5 className="text-sm font-bold text-orange-800">
                            2.2) 불투명부위 일사 열획득 상세 (Opaque Solar
                            Gains)
                          </h5>
                          <span className="text-xs text-orange-600/70 italic">
                            *{" "}
                            <InlineMath math="Q_{S,opak} = R_{se} \cdot U \cdot A \cdot (\alpha \cdot I_S - F_f \cdot h_r \cdot \Delta\theta_{er} \cdot t)" />
                          </span>
                        </div>
                        <div className="rounded-md border border-orange-200 overflow-hidden">
                          <Table className="text-[11px]">
                            <TableHeader className="bg-orange-50/50">
                              <TableRow>
                                <TableHead>부위 (Surface)</TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="A" />
                                </TableHead>
                                <TableHead className="text-right">
                                  방위
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="U" />
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="\alpha" />
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="R_{se}" />
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="I_S" />
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="F_r" />
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="\Delta\theta_{er}" />
                                </TableHead>
                                <TableHead className="text-right">
                                  <InlineMath math="h_r" />
                                </TableHead>
                                <TableHead className="text-right font-bold text-orange-700 bg-orange-100/30">
                                  <InlineMath math="Q_S" /> (kWh)
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {opDetails.length >
                                0 ? (
                                opDetails.map(
                                  (detail: any, idx: number) => (
                                    <TableRow key={`op-${idx}`}>
                                      <TableCell className="font-medium">
                                        {detail.name}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.area, 2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {detail.orientation}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.u_value, 3)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.alpha, 2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.r_se || 0.04, 3)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.I_sol_kwh, 1)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.f_f_sky || 1.0, 2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.delta_theta_er || 0, 1)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(detail.h_r || 0, 1)}
                                      </TableCell>
                                      <TableCell className="text-right font-bold text-orange-600">
                                        {formatNum(detail.Q_sol_kwh, 1)}
                                      </TableCell>
                                    </TableRow>
                                  ),
                                )
                              ) : (
                                <TableRow>
                                  <TableCell
                                    colSpan={11}
                                    className="text-center py-4 text-muted-foreground font-sans text-xs"
                                  >
                                    불투명부재 데이터 없음
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* 2.3) 일사 열획득 총괄 요약 */}
                      <div className="space-y-4 pt-4 border-t border-dashed border-orange-200 mt-2">
                        <h5 className="text-sm font-bold text-orange-800">
                          2.3) 일사 열획득 총괄 요약 (Total Solar Summary)
                        </h5>
                        <div className="rounded-md border border-orange-200 overflow-hidden">
                          <Table className="text-xs">
                            <TableHeader className="bg-orange-50/50">
                              <TableRow>
                                <TableHead className="w-[100px]">
                                  구분 (State)
                                </TableHead>
                                <TableHead className="text-right">
                                  일수 (d)
                                </TableHead>
                                <TableHead className="text-right">
                                  기간 (t, h)
                                </TableHead>
                                <TableHead className="text-right text-orange-600/80">
                                  투명부위
                                </TableHead>
                                <TableHead className="text-right text-orange-800/80">
                                  불투명부위
                                </TableHead>
                                <TableHead className="text-right font-bold text-orange-700 bg-orange-100/30">
                                  <InlineMath math="Q_S" /> (kWh/월)
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">
                                  사용일 (Usage)
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(currentMonthData.d_nutz, 2)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    (currentMonthData.d_nutz || 0) * 24,
                                    0,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    QS_tr_op,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    QS_opak_op,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-bold text-orange-600">
                                  {formatNum(
                                    QS_sol_op_total,
                                    1,
                                  )}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">
                                  비사용일 (Non-Usage)
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(currentMonthData.d_we, 2)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    (currentMonthData.d_we || 0) * 24,
                                    0,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    QS_tr_non_op,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    QS_opak_non_op,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-bold text-orange-600">
                                  {formatNum(
                                    QS_sol_non_op_total,
                                    1,
                                  )}
                                </TableCell>
                              </TableRow>
                              <TableRow className="bg-orange-50 font-bold border-t-2 border-orange-100">
                                <TableCell>Total 합계</TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    (currentMonthData.d_nutz || 0) +
                                    (currentMonthData.d_we || 0),
                                    2,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {new Date(2023, selectedMonth, 0).getDate() *
                                    24}
                                </TableCell>
                                <TableCell className="text-right text-orange-500">
                                  {formatNum(
                                    QS_tr_total,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-orange-800">
                                  {formatNum(
                                    QS_op_total,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-orange-700 bg-orange-100/50">
                                  {formatNum(currentMonthData.QS, 1)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>

                    {/* 3) 내부 열획득 상세 */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <h4 className="text-base font-bold text-orange-800 border-b border-orange-100 pb-2 mb-2">
                          3) 내부 열획득 상세 (Internal -{" "}
                          <InlineMath math="Q_I = Q_{I,int} + Q_{I,sys}" />)
                        </h4>
                        <span className="text-xs text-orange-600/70 italic mb-2 whitespace-nowrap">
                          * <InlineMath math="Q_{I,sys}" />: 시스템 손실(배관, 저장조)로 인한 내부 발열
                        </span>
                      </div>
                      <div className="space-y-4 mt-2">
                        <div className="flex justify-between items-end">
                          <h5 className="text-sm font-bold text-orange-800">
                            3.1) 내부 열획득 총괄 요약 (Internal Heat Summary)
                          </h5>
                          <span className="text-xs text-orange-600/70 italic">
                            *{" "}
                            <InlineMath math="Q_I = (q_{I,p} + q_{I,l} + q_{I,f}) \cdot A \cdot t + Q_{I,w}" />
                          </span>
                        </div>
                        <div className="rounded-md border border-orange-200 overflow-hidden">
                          <Table className="text-xs">
                            <TableHeader className="bg-orange-50/50">
                              <TableRow>
                                <TableHead>구분 (State)</TableHead>
                                <TableHead className="text-right">
                                  일수 (d)
                                </TableHead>
                                <TableHead className="text-right">
                                  기간 (t, h)
                                </TableHead>
                                <TableHead className="text-right text-blue-600/80">
                                  인체 (<InlineMath math="Q_{I,p}" />)
                                </TableHead>
                                <TableHead className="text-right text-yellow-600/80">
                                  조명 (<InlineMath math="Q_{I,l}" />)
                                </TableHead>
                                <TableHead className="text-right text-green-600/80">
                                  기기 (<InlineMath math="Q_{I,f}" />)
                                </TableHead>
                                <TableHead className="text-right text-red-600/80">
                                  기타 (<InlineMath math="Q_{I,w+g}" />)
                                </TableHead>
                                <TableHead className="text-right font-bold text-orange-700 bg-orange-100/30">
                                  <InlineMath math="Q_I" /> (kWh/월)
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow className="bg-orange-50/30">
                                <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-1 font-semibold">
                                  내부 발열 (Internal Gains)
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">
                                  사용일 (Usage)
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(currentMonthData.d_nutz, 2)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    (currentMonthData.d_nutz || 0) * 24,
                                    0,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    currentMonthData.internalGains?.op?.Q_I_p,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    currentMonthData.internalGains?.op?.Q_I_l,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    currentMonthData.internalGains?.op?.Q_I_fac,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    (currentMonthData.internalGains
                                      ?.op?.Q_I_goods || 0) +
                                    (currentMonthData.internalGains
                                      ?.op?.Q_I_w || 0),
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-bold text-orange-600">
                                  {formatNum(
                                    currentMonthData.QI, // using total QI for now, need logic for op total if missing
                                    1,
                                  )}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">
                                  비사용일 (Non-Usage)
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(currentMonthData.d_we, 2)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    (currentMonthData.d_we || 0) * 24,
                                    0,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    currentMonthData.internalGains
                                      ?.non_op?.Q_I_p,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    currentMonthData.internalGains
                                      ?.non_op?.Q_I_l,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    currentMonthData.internalGains
                                      ?.non_op?.Q_I_fac,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    (currentMonthData.internalGains
                                      ?.non_op?.Q_I_goods || 0) +
                                    (currentMonthData.internalGains
                                      ?.non_op?.Q_I_w || 0),
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-bold text-orange-600">
                                  {formatNum(
                                    0, // placeholder
                                    1,
                                  )}
                                </TableCell>
                              </TableRow>


                              <TableRow className="bg-orange-50 font-bold border-t-2 border-orange-100">
                                <TableCell>Total 합계</TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    (currentMonthData.d_nutz || 0) +
                                    (currentMonthData.d_we || 0),
                                    2,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {new Date(2023, selectedMonth, 0).getDate() *
                                    24}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    currentMonthData.internalGains?.Q_I_p,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    currentMonthData.internalGains?.Q_I_l,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    currentMonthData.internalGains?.Q_I_fac,
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNum(
                                    (currentMonthData.internalGains
                                      ?.Q_l_source_goods || 0) +
                                    (currentMonthData.internalGains?.Q_I_w ||
                                      0),
                                    1,
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-orange-700 bg-orange-100/50">
                                  {formatNum(currentMonthData.QI, 1)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>

                        {/* 3.2) 시스템 손실 상세 (System Losses - New Table) */}
                        <div className="space-y-4 pt-4 border-t border-dashed border-orange-200 mt-2">
                          <div className="flex justify-between items-end">
                            <h5 className="text-sm font-bold text-orange-800">
                              3.2) 시스템 손실 상세 (System Internal Gains <InlineMath math="Q_{I,sys}" />)
                            </h5>
                            <span className="text-xs text-orange-600/70 italic">
                              * 난방/급탕 손실은 내부발열로 작용 (Total에 포함), 냉방 손실은 부하로 작용 (Total 제외)
                            </span>
                          </div>
                          <div className="rounded-md border border-orange-200 overflow-hidden">
                            <Table className="text-xs">
                              <TableHeader className="bg-orange-50/50">
                                <TableRow>
                                  <TableHead className="w-[120px]">구분 (State)</TableHead>
                                  <TableHead className="text-right text-red-600/80">
                                    난방 배관/저장
                                  </TableHead>
                                  <TableHead className="text-right text-cyan-600/80 bg-cyan-50/30">
                                    냉방 배관/저장*
                                  </TableHead>
                                  <TableHead className="text-right text-orange-600/80">
                                    급탕 배관/저장
                                  </TableHead>
                                  <TableHead className="text-right font-bold text-orange-700 bg-orange-100/30">
                                    시스템 손실 기여분 (kWh/월)
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="font-medium">사용일 (Usage)</TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.systemLosses?.heating?.details?.distribution?.op?.Q_loss || 0) +
                                      (currentMonthData.systemLosses?.heating?.details?.storage?.op?.Q_loss || 0),
                                      1
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right bg-cyan-50/30 text-cyan-700">
                                    {formatNum(
                                      (currentMonthData.systemLosses?.cooling?.details?.distribution?.op?.Q_loss || 0) +
                                      (currentMonthData.systemLosses?.cooling?.details?.storage?.op?.Q_loss || 0),
                                      1
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.internalGains?.op?.Q_w_d || 0) +
                                      (currentMonthData.internalGains?.op?.Q_w_s || 0),
                                      1
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-orange-600 bg-orange-100/30">
                                    {formatNum(
                                      ((currentMonthData.systemLosses?.heating?.details?.distribution?.op?.Q_loss || 0) +
                                        (currentMonthData.systemLosses?.heating?.details?.storage?.op?.Q_loss || 0)) +
                                      ((currentMonthData.internalGains?.op?.Q_w_d || 0) +
                                        (currentMonthData.internalGains?.op?.Q_w_s || 0)),
                                      1
                                    )}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">비사용일 (Non-Usage)</TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.systemLosses?.heating?.details?.distribution?.non_op?.Q_loss || 0) +
                                      (currentMonthData.systemLosses?.heating?.details?.storage?.non_op?.Q_loss || 0),
                                      1
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right bg-cyan-50/30 text-cyan-700">
                                    {formatNum(
                                      (currentMonthData.systemLosses?.cooling?.details?.distribution?.non_op?.Q_loss || 0) +
                                      (currentMonthData.systemLosses?.cooling?.details?.storage?.non_op?.Q_loss || 0),
                                      1
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.internalGains?.non_op?.Q_w_s || 0),
                                      1
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-orange-600 bg-orange-100/30">
                                    {formatNum(
                                      ((currentMonthData.systemLosses?.heating?.details?.distribution?.non_op?.Q_loss || 0) +
                                        (currentMonthData.systemLosses?.heating?.details?.storage?.non_op?.Q_loss || 0)) +
                                      (currentMonthData.internalGains?.non_op?.Q_w_s || 0),
                                      1
                                    )}
                                  </TableCell>
                                </TableRow>
                                <TableRow className="bg-orange-50 font-bold border-t-2 border-orange-100">
                                  <TableCell>Total 합계</TableCell>
                                  <TableCell className="text-right text-red-600">
                                    {formatNum(
                                      (currentMonthData.systemLosses?.heating?.distribution || 0) +
                                      (currentMonthData.systemLosses?.heating?.storage || 0),
                                      1
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-cyan-600 bg-cyan-50/30">
                                    {formatNum(
                                      (currentMonthData.systemLosses?.cooling?.distribution || 0) +
                                      (currentMonthData.systemLosses?.cooling?.storage || 0),
                                      1
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-orange-600">
                                    {formatNum(
                                      currentMonthData.internalGains?.Q_I_w || 0,
                                      1
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-orange-700 bg-orange-100/50">
                                    {formatNum(
                                      ((currentMonthData.systemLosses?.heating?.distribution || 0) +
                                        (currentMonthData.systemLosses?.heating?.storage || 0)) +
                                      (currentMonthData.internalGains?.Q_I_w || 0),
                                      1
                                    )}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 관류가 열획득인 경우 표시 */}
                    {isTSource && (
                      <div className="space-y-6 pt-4 border-t border-dashed border-orange-200 mt-2">
                        <h4 className="text-base font-bold text-orange-800 border-b border-orange-100 pb-2 mb-2">
                          4) 관류 열획득 상세 (Transmission Gains)
                        </h4>
                        <p className="text-[11px] text-orange-600 italic">
                          ⚠️ 외기 온도 ({formatNum(Te, 1)}°C)가 실내 설정 온도 (
                          {formatNum(Ti_eff, 1)}°C)보다 높아 관류가 열획득
                          성분이 되었습니다.
                        </p>

                        {/* 4.1) 관류 열전달계수 */}
                        <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <h5 className="text-sm font-bold text-orange-800">
                              4.1) 관류 열전달계수 산정 (H-Value Breakdown)
                            </h5>
                            <span className="text-xs text-orange-600/70 italic">
                              * 수조합 열전달계수 (<InlineMath math="H_{tr}" />)
                              산출 근거
                            </span>
                          </div>
                          <div className="rounded-md border border-orange-200 overflow-hidden">
                            <Table className="text-xs">
                              <TableHeader className="bg-orange-50/50">
                                <TableRow>
                                  <TableHead>부위 (Surface)</TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="A" /> (m²)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="U" /> (W/m²K)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="F_x" />
                                  </TableHead>
                                  <TableHead className="text-right font-bold text-orange-700 bg-orange-100/30">
                                    <InlineMath math="H_{tr}" /> (W/K)
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {currentMonthData.transmissionBySurface &&
                                  Object.entries(
                                    currentMonthData.transmissionBySurface,
                                  ).map(([id, info]: any) => (
                                    <TableRow key={id}>
                                      <TableCell className="font-medium text-[11px]">
                                        {info.name}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(info.area, 2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(info.U, 3)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(info.fx || 1.0, 2)}
                                      </TableCell>
                                      <TableCell className="text-right font-bold text-orange-600">
                                        {formatNum(info.H_tr, 2)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                <TableRow className="bg-orange-50/50 font-bold border-t border-orange-100">
                                  <TableCell>
                                    열교 합계 (<InlineMath math="H_{\psi}" />)
                                  </TableCell>
                                  <TableCell className="text-right">
                                    -
                                  </TableCell>
                                  <TableCell
                                    colSpan={2}
                                    className="text-right text-[10px] text-orange-600/60 font-normal italic"
                                  >
                                    Thermal Bridges (Psi total)
                                  </TableCell>
                                  <TableCell className="text-right text-orange-700 bg-orange-100/50">
                                    {formatNum(currentMonthData.H_tr_WB, 2)}
                                  </TableCell>
                                </TableRow>
                                <TableRow className="bg-orange-100/20 font-bold border-t-2 border-orange-100">
                                  <TableCell>
                                    관류 총계 (
                                    <InlineMath math="H_{tr,total}" />)
                                  </TableCell>
                                  <TableCell
                                    colSpan={3}
                                    className="text-right text-[10px] text-orange-700/60 font-normal italic"
                                  >
                                    H_tr = Sum(A * U * Fx) + H_psi
                                  </TableCell>
                                  <TableCell className="text-right text-orange-800 bg-orange-100/50">
                                    {formatNum(currentMonthData.H_tr_total, 2)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* 4.2) 관류 열수지 */}
                        <div className="space-y-4 mt-6">
                          <h5 className="text-sm font-bold flex justify-between text-orange-800">
                            <span>
                              4.2) 관류 열수지 계산 상세 (Transmission Energy
                              Balance)
                            </span>
                            <span className="text-orange-600">
                              {formatNum(QT_val)} kWh/월
                            </span>
                          </h5>
                          <div className="rounded-md border border-orange-200 overflow-hidden">
                            <Table className="text-xs">
                              <TableHeader className="bg-orange-50/50">
                                <TableRow>
                                  <TableHead>구분 (State)</TableHead>
                                  <TableHead className="text-right">
                                    일수 (d)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="H_{tr,total}" />
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="\theta_e" />
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="\theta_i" />
                                  </TableHead>
                                  <TableHead className="text-right">
                                    기간 (t, h)
                                  </TableHead>
                                  <TableHead className="text-right font-bold text-orange-700 bg-orange-100/30">
                                    <InlineMath math="Q_T" /> (kWh)
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    사용일 (Usage Days)
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.d_nutz, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_tr_total, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(Te, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      currentMonthData.Theta_i_h_op || Ti_eff,
                                      1,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_nutz || 0) * 24,
                                      0,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-orange-600">
                                    {formatNum(currentMonthData.QT_op, 1)}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    비사용일 (Non-Usage)
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.d_we, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_tr_total, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(Te, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      currentMonthData.Theta_i_h_non_op ||
                                      Ti_eff,
                                      1,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_we || 0) * 24,
                                      0,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-orange-600">
                                    {formatNum(currentMonthData.QT_non_op, 1)}
                                  </TableCell>
                                </TableRow>
                                <TableRow className="bg-orange-50 font-bold border-t-2 border-orange-100">
                                  <TableCell>Total 합계</TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_nutz || 0) +
                                      (currentMonthData.d_we || 0),
                                      2,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_tr_total, 1)}
                                  </TableCell>
                                  <TableCell
                                    colSpan={2}
                                    className="text-center text-[10px] text-orange-600/60 font-normal italic"
                                  >
                                    Monthly Weighted Average
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {new Date(
                                      2023,
                                      selectedMonth,
                                      0,
                                    ).getDate() * 24}
                                  </TableCell>
                                  <TableCell className="text-right text-orange-700 bg-orange-100/50">
                                    {formatNum(QT_val, 1)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 환기가 열획득인 경우 표시 */}
                    {isVSource && (
                      <div className="space-y-6 pt-4 border-t border-dashed border-orange-200 mt-2">
                        <h4 className="text-base font-bold text-orange-800 border-b border-orange-100 pb-2 mb-2">
                          5) 환기 열획득 상세 (Ventilation Gains)
                        </h4>
                        <p className="text-[11px] text-orange-600 italic">
                          ⚠️ 외기 온도 ({formatNum(Te, 1)}°C)가 실내 설정 온도 (
                          {formatNum(Ti_eff, 1)}°C)보다 높아 환기가 열획득
                          성분이 되었습니다.
                        </p>

                        {/* 5.1) 공통 환기 입력값 */}
                        <div className="space-y-2">
                          <h5 className="text-sm font-bold text-orange-800">
                            5.1) 공통 환기 입력값 (Common Zone Input Parameters)
                          </h5>
                          <div className="rounded-md border border-orange-200 overflow-hidden">
                            <Table className="text-[11px]">
                              <TableHeader className="bg-orange-50/30">
                                <TableRow>
                                  <TableHead className="text-right">
                                    <InlineMath math="A_{NGF}" /> (m²)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="h_R" /> (m)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="V_{net}" /> (m³)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="n_{SUP}" /> (h⁻¹)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="n_{ETA}" /> (h⁻¹)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="\eta_{rec}" />
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.A_NGF, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.roomHeight, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.V_net, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.n_SUP, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.n_ETA, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      currentMonthData.heatRecoveryEff,
                                      2,
                                    )}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* 5.2) 열전달계수 산정 */}
                        <div className="space-y-2">
                          <h5 className="text-sm font-bold text-orange-800">
                            5.2) 환기 열전달계수 산정 (H_ve Calculation)
                          </h5>
                          <div className="rounded-md border border-orange-200 overflow-hidden">
                            <Table className="text-[10px]">
                              <TableHeader className="bg-orange-50/50">
                                <TableRow>
                                  <TableHead className="text-right border-l">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="e_{shield}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="e_{shield}" /> —
                                          차폐 계수
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          건물의 차폐 정도에 따른 계수 (식 68)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="f_{wind}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="f_{wind}" /> — 풍속
                                          보정 계수 [식 69/70]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          차폐 및 층수 보정 (주거: 1.0, 비주거:
                                          1.0)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="f_e" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="f_e" /> — 급/배기
                                          불균형 보정 계수 [식 72]
                                        </p>
                                        <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                          <p><InlineMath math="n_{SUP} \ge n_{ETA}" />: <InlineMath math="f_e = 1" /></p>
                                          <p>
                                            <InlineMath math="n_{SUP} < n_{ETA}" />:
                                            <InlineMath math="f_e = \frac{1}{1 + (f/e) \cdot (\frac{n_{ETA} - n_{SUP}}{n_{50} \cdot f_{ATD}})^2}" />
                                          </p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right font-bold border-r border-orange-100 text-amber-700">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="n_{inf}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="n_{inf}" /> — 침기
                                          환기 횟수 [식 66/67]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          <InlineMath math="n_{inf} = n_{50} \cdot e \cdot f_{ATD} (\cdot f_e)" />
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="n_{win,min}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="n_{win,min}" /> —
                                          창문 최소 환기
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          위생적 창문 최소 환기 횟수 (주거: 0.1)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="\Delta n_{win}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="\Delta n_{win}" /> —
                                          추가 자연 창문환기 [식 81/82]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          필요 환기량 충족 유지를 위한 추가 자연
                                          환기
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right font-bold border-r border-orange-100 text-orange-700">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="n_{win}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="n_{win}" /> — 유효
                                          창문 환기 횟수 [식 83/84]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          사용 시간 및 외기 조건 보정 창문 환기
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="\dot{V}_{A,Geb}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="\dot{V}_{A,Geb}" />{" "}
                                          — 건물 최소 외기 도입량
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          사용 프로필의{" "}
                                          <InlineMath math="\dot{V}_A" /> 값
                                          (기본값)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right font-bold border-r border-orange-100 text-yellow-700">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="n_{mech}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="n_{mech}" /> — 유효
                                          기계 환기 횟수
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          <InlineMath math="n_{mech} = n_{SUP} \cdot (1 - \eta_{rec}) \cdot (t_{V,mech} / 24)" />
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right font-bold text-orange-800 bg-orange-100/30">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="H_{ve}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="H_{ve}" /> — 환기
                                          열전달계수 [식 56]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          <InlineMath math="H_{ve} = \rho c_p \cdot V \cdot (n_{inf} + n_{win} + n_{mech})" />
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right font-bold text-amber-800 bg-amber-100/30 border-l border-orange-200">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="H_{ve,\tau}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="H_{ve,\tau}" /> — 시상수용 환기 계수
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          <InlineMath math="\tau" /> 계산용 유효 열전달계수 (열회수 반영)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="text-right border-l">
                                    {formatNum(currentMonthData.e_shield, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.f_wind, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.f_e, 2)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-amber-700 border-r border-orange-100">
                                    {formatNum(currentMonthData.n_inf, 3)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.n_win_min, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.Delta_n_win, 3)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-orange-700 border-r border-orange-100">
                                    {formatNum(currentMonthData.n_win, 3)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.V_A_Geb, 2)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-yellow-700 border-r border-orange-100">
                                    {formatNum(currentMonthData.n_mech, 3)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold bg-orange-50/50 text-orange-800">
                                    {formatNum(currentMonthData.H_ve, 1)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold bg-amber-50/50 text-amber-800 border-l border-orange-200">
                                    {formatNum(balanceMode === "heating" ? currentMonthData.H_ve_tau_h : currentMonthData.H_ve_tau_c, 1)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* 5.3) 환기 열수지 계산 상세 */}
                        <div className="space-y-3">
                          <h5 className="text-sm font-bold flex justify-between text-orange-800">
                            <span>
                              5.3) 환기 열수지 계산 상세 (Ventilation Energy
                              Balance)
                            </span>
                            <span className="text-orange-600">
                              {formatNum(QV_val)} kWh/월
                            </span>
                          </h5>
                          <div className="rounded-md border border-orange-200 overflow-hidden">
                            <Table className="text-xs">
                              <TableHeader className="bg-orange-50/50">
                                <TableRow>
                                  <TableHead>구분 (State)</TableHead>
                                  <TableHead className="text-right">
                                    일수 (d)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="H_{ve,tot}" /> (W/K)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="\theta_e" /> (°C)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="\theta_i" /> (°C)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    기간 (t, h)
                                  </TableHead>
                                  <TableHead className="text-right font-bold text-orange-700 bg-orange-100/30">
                                    <InlineMath math="Q_{ve}" /> (kWh/월)
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    사용일 (Usage Days)
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.d_nutz, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_ve, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(Te, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      currentMonthData.Theta_i_h_op || Ti_eff,
                                      1,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_nutz || 0) * 24,
                                      0,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-orange-600">
                                    {formatNum(currentMonthData.QV_op, 1)}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    비사용일 (Non-Usage)
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.d_we, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_ve, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(Te, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      currentMonthData.Theta_i_h_non_op ||
                                      Ti_eff,
                                      1,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_we || 0) * 24,
                                      0,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-orange-600">
                                    {formatNum(currentMonthData.QV_non_op, 1)}
                                  </TableCell>
                                </TableRow>
                                <TableRow className="bg-orange-50 font-bold border-t-2 border-orange-100">
                                  <TableCell>Total 합계</TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_nutz || 0) +
                                      (currentMonthData.d_we || 0),
                                      2,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_ve, 1)}
                                  </TableCell>
                                  <TableCell
                                    colSpan={2}
                                    className="text-center text-[10px] text-orange-600/60 font-normal italic"
                                  >
                                    Monthly Weighted Average
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {new Date(
                                      2023,
                                      selectedMonth,
                                      0,
                                    ).getDate() * 24}
                                  </TableCell>
                                  <TableCell className="text-right text-orange-700 bg-orange-100/50">
                                    {formatNum(QV_val, 1)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            <div className="h-px bg-slate-200" />

            {/* B. 열 제거 성분 (열손실) */}
            <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
              <button
                onClick={() => toggleStep("step3")}
                className={cn(
                  "w-full flex items-center justify-between p-4 transition-colors text-left",
                  expandedSteps.step3
                    ? "bg-blue-50/50 border-b border-blue-100"
                    : "hover:bg-blue-50/30",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 p-1 rounded font-mono text-sm">
                    Step 3
                  </span>
                  <h3 className="text-lg font-semibold text-blue-700">
                    월간 열손실 성분 (Monthly Heat Losses / Senken)
                  </h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-blue-700 font-bold text-sm">
                    {formatNum(Q_sinks, 1)} kWh/월
                  </div>
                  {expandedSteps.step3 ? (
                    <ChevronDown className="h-5 w-5 text-blue-300" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-blue-300" />
                  )}
                </div>
              </button>

              {expandedSteps.step3 && (
                <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex flex-col gap-10">
                    {/* 관류 상세 정보 */}
                    {!isTSource ? (
                      <div className="space-y-6">
                        <h4 className="text-base font-bold text-blue-800 border-b border-blue-100 pb-2 mb-2">
                          6) 관류 열손실 상세 (Transmission Losses)
                        </h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <h5 className="text-sm font-bold text-blue-800">
                              6.1) 관류 열전달계수 산정 (H-Value Breakdown)
                            </h5>
                            <span className="text-xs text-blue-600/70 italic">
                              * 수조합 열전달계수 (<InlineMath math="H_{tr}" />)
                              산출 근거
                            </span>
                          </div>
                          <div className="rounded-md border border-blue-200 overflow-hidden">
                            <Table className="text-xs">
                              <TableHeader className="bg-blue-50/50">
                                <TableRow>
                                  <TableHead>부위 (Surface)</TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="A" /> (m²)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="U" /> (W/m²K)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="F_x" />
                                  </TableHead>
                                  <TableHead className="text-right font-bold text-blue-700 bg-blue-100/30">
                                    <InlineMath math="H_{tr}" /> (W/K)
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {currentMonthData.transmissionBySurface &&
                                  Object.entries(
                                    currentMonthData.transmissionBySurface,
                                  ).map(([id, info]: any) => (
                                    <TableRow key={id}>
                                      <TableCell className="font-medium text-[11px]">
                                        {info.name}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(info.area, 2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(info.U, 3)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatNum(info.fx || 1.0, 2)}
                                      </TableCell>
                                      <TableCell className="text-right font-bold text-blue-600">
                                        {formatNum(info.H_tr, 2)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                <TableRow className="bg-blue-50/50 font-bold border-t border-blue-100">
                                  <TableCell>
                                    열교 합계 (<InlineMath math="H_{\psi}" />)
                                  </TableCell>
                                  <TableCell className="text-right">
                                    -
                                  </TableCell>
                                  <TableCell
                                    colSpan={2}
                                    className="text-right text-[10px] text-blue-600/60 font-normal italic"
                                  >
                                    Thermal Bridges (Psi total)
                                  </TableCell>
                                  <TableCell className="text-right text-blue-700 bg-blue-100/50">
                                    {formatNum(currentMonthData.H_tr_WB, 2)}
                                  </TableCell>
                                </TableRow>
                                <TableRow className="bg-blue-100/20 font-bold border-t-2 border-blue-100">
                                  <TableCell>
                                    관류 총계 (
                                    <InlineMath math="H_{tr,total}" />)
                                  </TableCell>
                                  <TableCell
                                    colSpan={3}
                                    className="text-right text-[10px] text-blue-700/60 font-normal italic"
                                  >
                                    H_tr = Sum(A * U * Fx) + H_psi
                                  </TableCell>
                                  <TableCell className="text-right text-blue-800 bg-blue-100/50">
                                    {formatNum(currentMonthData.H_tr_total, 2)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        <div className="space-y-4 mt-6">
                          <h5 className="text-sm font-bold flex justify-between text-blue-800">
                            <span>
                              6.2) 관류 열수지 계산 상세 (Transmission Energy
                              Balance)
                            </span>
                            <span className="text-blue-600">
                              {formatNum(QT_val)} kWh/월
                            </span>
                          </h5>
                          <div className="rounded-md border border-blue-200 overflow-hidden">
                            <Table className="text-xs">
                              <TableHeader className="bg-blue-50/50">
                                <TableRow>
                                  <TableHead>구분 (State)</TableHead>
                                  <TableHead className="text-right">
                                    일수 (d)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="H_{tr,total}" />
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="\theta_e" />
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="\theta_i" />
                                  </TableHead>
                                  <TableHead className="text-right">
                                    기간 (t, h)
                                  </TableHead>
                                  <TableHead className="text-right font-bold text-blue-700 bg-blue-100/30">
                                    <InlineMath math="Q_T" /> (kWh)
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    사용일 (Usage Days)
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.d_nutz, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_tr_total, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(Te, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      currentMonthData.Theta_i_h_op || Ti_eff,
                                      1,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_nutz || 0) * 24,
                                      0,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-blue-600">
                                    {formatNum(currentMonthData.QT_op, 1)}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    비사용일 (Non-Usage)
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.d_we, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_tr_total, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(Te, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      currentMonthData.Theta_i_h_non_op ||
                                      Ti_eff,
                                      1,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_we || 0) * 24,
                                      0,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-blue-600">
                                    {formatNum(currentMonthData.QT_non_op, 1)}
                                  </TableCell>
                                </TableRow>
                                <TableRow className="bg-blue-50 font-bold border-t-2 border-blue-100">
                                  <TableCell>Total 합계</TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_nutz || 0) +
                                      (currentMonthData.d_we || 0),
                                      2,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_tr_total, 1)}
                                  </TableCell>
                                  <TableCell
                                    colSpan={2}
                                    className="text-center text-[10px] text-blue-600/60 font-normal italic"
                                  >
                                    Monthly Weighted Average
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {new Date(
                                      2023,
                                      selectedMonth,
                                      0,
                                    ).getDate() * 24}
                                  </TableCell>
                                  <TableCell className="text-right text-blue-700 bg-blue-100/50">
                                    {formatNum(QT_val, 1)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* 환기 상세 정보 */}
                    {!isVSource ? (
                      <div className="space-y-6">
                        <div className="pt-4 border-t-2 border-dashed border-blue-100 mt-2">
                          <h4 className="text-base font-bold text-blue-800 mb-4 px-1">
                            7) 환기 열손실 상세 (Ventilation Losses)
                          </h4>
                        </div>
                        {/* 7.1) 공통 환기 입력값 */}
                        <div className="space-y-2">
                          <h5 className="text-sm font-bold text-blue-800">
                            7.1) 공통 환기 입력값 (Common Zone Input Parameters)
                          </h5>
                          <div className="rounded-md border border-blue-200 overflow-hidden">
                            <Table className="text-[11px]">
                              <TableHeader className="bg-blue-50/30">
                                <TableRow>
                                  <TableHead className="text-right">
                                    <InlineMath math="A_{NGF}" /> (m²)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="h_R" /> (m)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="V_{net}" /> (m³)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="n_{SUP}" /> (h⁻¹)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="n_{ETA}" /> (h⁻¹)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="\eta_{rec}" />
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.A_NGF, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.roomHeight, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.V_net, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.n_SUP, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.n_ETA, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      currentMonthData.heatRecoveryEff,
                                      2,
                                    )}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* 7.2) 환기 열전달계수 상세 산출 */}
                        <div className="space-y-2">
                          <h5 className="text-sm font-bold text-blue-800">
                            7.2) 환기 열전달계수 산정 (H_ve Calculation)
                          </h5>
                          <div className="rounded-md border border-blue-200 overflow-hidden">
                            <Table className="text-[10px]">
                              <TableHeader className="bg-blue-50/50">
                                <TableRow>
                                  <TableHead className="text-right border-l">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="e_{shield}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="e_{shield}" /> —
                                          차폐 계수
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          건물의 차폐 정도에 따른 계수 (식 68)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="f_{wind}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="f_{wind}" /> — 풍속
                                          보정 계수 [식 69/70]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          차폐 및 층수 보정 (주거: 1.0, 비주거:
                                          1.0)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="f_e" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="f_e" /> — 급/배기
                                          불균형 보정 계수 [식 71/72]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          <InlineMath math="n_{SUP} < n_{ETA}" />{" "}
                                          시 <InlineMath math="n_{inf}" /> 보정
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right font-bold border-r border-blue-100 text-amber-700">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="n_{inf}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="n_{inf}" /> — 침기
                                          환기 횟수 [식 66/67]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          <InlineMath math="n_{inf} = n_{50} \cdot e \cdot f_{ATD} (\cdot f_e)" />
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="n_{win,min}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="n_{win,min}" /> —
                                          창문 최소 환기
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          위생적 창문 최소 환기 횟수 (주거: 0.1)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="\Delta n_{win}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="\Delta n_{win}" /> —
                                          추가 자연 창문환기 [식 81/82]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          필요 환기량 충족 유지를 위한 추가 자연
                                          환기
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right font-bold border-r border-blue-100 text-blue-700">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="n_{win}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="n_{win}" /> — 유효
                                          창문 환기 횟수 [식 83/84]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          운전 시간 및 외기 조건 보정 창문 환기
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="\dot{V}_{A,Geb}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="\dot{V}_{A,Geb}" />{" "}
                                          — 건물 최소 외기 도입량
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          사용 프로필의{" "}
                                          <InlineMath math="\dot{V}_A" /> 값
                                          (기본값)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right font-bold border-r border-blue-100 text-violet-700">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="n_{mech}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="n_{mech}" /> — 유효
                                          기계 환기 횟수
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          <InlineMath math="n_{mech} = n_{SUP} \cdot (1 - \eta_{rec}) \cdot (t_{V,mech} / 24)" />
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>

                                  <TableHead className="text-right font-bold border-r border-blue-100 text-blue-800 bg-blue-100/30">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="H_{ve}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="H_{ve}" /> — 환기
                                          열전달계수 [식 56]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          열수지(Energy Balance) 계산용
                                          <br />
                                          <InlineMath math="H_{ve} = \rho c_p \cdot V \cdot (n_{inf} + n_{win} + n_{mech})" />
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                  <TableHead className="text-right font-bold text-amber-800 bg-amber-100/30">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help decoration-dotted underline underline-offset-2">
                                          <InlineMath math="H_{ve,\tau}" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm p-3">
                                        <p className="font-semibold mb-1">
                                          <InlineMath math="H_{ve,\tau}" /> —
                                          시상수용 환기 계수 [식 140-143]
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          시상수(<InlineMath math="\tau" />) 계산용
                                          <br />
                                          기계환기(열회수) 시 유효 온도차 적용 (6K Rule)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="text-right border-l">
                                    {formatNum(currentMonthData.e_shield, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.f_wind, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.f_e, 2)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-amber-700 border-r border-blue-100">
                                    {formatNum(currentMonthData.n_inf, 3)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.n_win_min, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.Delta_n_win, 3)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-blue-700 border-r border-blue-100">
                                    {formatNum(currentMonthData.n_win, 3)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.V_A_Geb, 2)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-violet-700 border-r border-blue-100">
                                    {formatNum(currentMonthData.n_mech, 3)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold bg-blue-50/50 text-blue-800">
                                    {formatNum(currentMonthData.H_ve, 1)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold bg-amber-50/50 text-amber-800 border-r border-blue-100">
                                    {formatNum(balanceMode === "heating" ? currentMonthData.H_ve_tau_h : currentMonthData.H_ve_tau_c, 1)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* 7.3) 환기 열수지 계산 상세 */}
                        <div className="space-y-3">
                          <h5 className="text-sm font-bold flex justify-between text-blue-800">
                            <span>
                              7.3) 환기 열수지 계산 상세 (Ventilation Energy
                              Balance)
                            </span>
                            <span className="text-blue-600">
                              {formatNum(QV_val)} kWh/월
                            </span>
                          </h5>
                          <div className="rounded-md border border-blue-200 overflow-hidden">
                            <Table className="text-xs">
                              <TableHeader className="bg-blue-50/50">
                                <TableRow>
                                  <TableHead>구분 (State)</TableHead>
                                  <TableHead className="text-right">
                                    일수 (<InlineMath math="d" />)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="H_{ve,tot}" /> (W/K)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="\theta_e" /> (°C)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <InlineMath math="\theta_i" /> (°C)
                                  </TableHead>
                                  <TableHead className="text-right">
                                    기간 (<InlineMath math="t" />, h)
                                  </TableHead>
                                  <TableHead className="text-right font-bold text-blue-700 bg-blue-100/30">
                                    <InlineMath math="Q_{ve}" /> (kWh/월)
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    사용일 (Usage Days)
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.d_nutz, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_ve, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(Te, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      currentMonthData.Theta_i_h_op || Ti_eff,
                                      1,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_nutz || 0) * 24,
                                      0,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-blue-600">
                                    {formatNum(currentMonthData.QV_op, 1)}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    비사용일 (Non-Usage)
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.d_we, 2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_ve, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(Te, 1)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      currentMonthData.Theta_i_h_non_op ||
                                      Ti_eff,
                                      1,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_we || 0) * 24,
                                      0,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-blue-600">
                                    {formatNum(currentMonthData.QV_non_op, 1)}
                                  </TableCell>
                                </TableRow>
                                <TableRow className="bg-blue-50 font-bold border-t-2 border-blue-100">
                                  <TableCell>Total 합계</TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(
                                      (currentMonthData.d_nutz || 0) +
                                      (currentMonthData.d_we || 0),
                                      2,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNum(currentMonthData.H_ve, 1)}
                                  </TableCell>
                                  <TableCell
                                    colSpan={2}
                                    className="text-center text-[10px] text-blue-600/60 font-normal italic"
                                  >
                                    Monthly Weighted Average
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {new Date(
                                      2023,
                                      selectedMonth,
                                      0,
                                    ).getDate() * 24}
                                  </TableCell>
                                  <TableCell className="text-right text-blue-700 bg-blue-100/50">
                                    {formatNum(QV_val, 1)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                          <div className="text-[10px] text-muted-foreground italic text-right px-1">
                            *{" "}
                            <InlineMath math="Q_V = \rho C_p \cdot V_{net} \cdot n_{avg} \cdot (\theta_i - \theta_e) \cdot t \cdot 10^{-3}" />
                            . 에너지 밸런스용 환기율은 계절 보정 및 열회수
                            효과가 포함된 유효값입니다.
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* 둘 다 획득일 때의 빈 상태 메시지 */}
                    {isTSource && isVSource && (
                      <div className="p-12 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                          <InlineMath math="T_e > T_{i,eff}" /> 조건으로 인해
                          자연적인 열손실(Sink) 성분이 존재하지 않습니다.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
              }
            </section >


          </div >
        </CardContent >
      </Card >
    </TooltipProvider >
  );
}
