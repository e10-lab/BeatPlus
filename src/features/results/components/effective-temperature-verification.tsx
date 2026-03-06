"use client";

import React, { useState } from "react";
import { MonthlyResult } from "@/engine/types";
import { Zone } from "@/types/project";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Tabs removed
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface EffectiveTemperatureVerificationProps {
    data: MonthlyResult[];
    title?: string;
    zone?: Zone;
}

export function EffectiveTemperatureVerification({ data, title, zone }: EffectiveTemperatureVerificationProps) {
    const [selectedMonth, setSelectedMonth] = useState<number>(data[0]?.month || 1);


    if (!data || data.length === 0) return <div className="p-4 text-center text-muted-foreground">데이터가 없습니다.</div>;

    const currentMonthData = data.find(m => m.month === selectedMonth) || data[0];

    // 1. Time Constant Variables
    const Cm = currentMonthData.Cm || 0;
    const H_tr = currentMonthData.H_tr || 0;
    const H_ve = currentMonthData.H_ve || 0;
    const H_tot = (currentMonthData.H_tot || (H_tr + H_ve));
    const tau = currentMonthData.tau_h || currentMonthData.tau || 0;

    // Check manual calc of tau for verification
    const tau_check = H_tot > 0 ? Cm / H_tot : 0;

    // 2. Utilization Factors
    const gamma = currentMonthData.gamma;
    const a = currentMonthData.a_H;
    const eta = currentMonthData.eta;

    // 3. Setpoints and Reductions
    const Theta_int_set = currentMonthData.Theta_int_H || 0;

    // Setback Factors
    const f_NA = currentMonthData.f_NA || 0;
    const f_we = currentMonthData.f_we || 0;

    // Reductions
    const Delta_theta_NA = currentMonthData.Delta_theta_i_NA || 0;
    const delta_theta_EMS = currentMonthData.delta_theta_EMS || 0;

    // Final Effective Temp
    const Theta_i_real = currentMonthData.Theta_i_h || currentMonthData.avg_Ti || 0;

    const formatNum = (val: number | undefined, decimals = 2) => val !== undefined ? val.toFixed(decimals) : "-";

    return (
        <TooltipProvider>
            <Card className="w-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                    <div>
                        <CardTitle>{title || "유효 실내 온도 산정 검증 (Effective Temperature)"}</CardTitle>
                        <CardDescription>
                            DIN 18599-2에 따른 시정수(<InlineMath math="\tau" />), 이용효율(<InlineMath math="\eta" />), 그리고 최종 유효 온도(<InlineMath math="\theta_{i,eff}" />) 산출 과정
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Mode Toggle Removed */}

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">조회 월:</span>
                            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                                <SelectTrigger className="w-[90px]">
                                    <SelectValue placeholder="월 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {data.map(m => (
                                        <SelectItem key={m.month} value={m.month.toString()}>{m.month}월</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">

                    {/* Step 1: Time Constant */}
                    <section className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-sm">Step 1</span>
                            시정수 산정 (Time Constant, <InlineMath math="\tau" />)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <div className="text-xs text-slate-500 font-medium mb-1">유효 열용량 (<InlineMath math="C_m" />)</div>
                                <div className="text-xl font-bold">{formatNum(Cm, 0)} <span className="text-sm font-normal">Wh/K</span></div>
                            </div>
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <div className="text-xs text-slate-500 font-medium mb-1">관류 열전달계수 (<InlineMath math="H_{tr}" />)</div>
                                <div className="text-xl font-bold">{formatNum(H_tr, 1)} <span className="text-sm font-normal">W/K</span></div>
                            </div>
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <div className="text-xs text-slate-500 font-medium mb-1">환기 열전달계수 (<InlineMath math="H_{ve}" />)</div>
                                <div className="text-xl font-bold">{formatNum(H_ve, 1)} <span className="text-sm font-normal">W/K</span></div>
                            </div>
                            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                                <div className="text-xs text-blue-600 font-medium mb-1">시정수 (<InlineMath math="\tau" />)</div>
                                <div className="text-2xl font-bold text-blue-700">{formatNum(tau, 1)} <span className="text-sm font-normal">h</span></div>
                                <div className="text-xs text-blue-500 mt-1">
                                    <InlineMath math="\tau = \frac{C_m}{H_{tr} + H_{ve}}" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Step 2: Setback Factors */}
                    <section className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-sm">Step 2</span>
                            감경 계수 (Setback Factors, <InlineMath math="f_{NA}, f_{we}" />)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1">
                                            야간 감경 계수 (<InlineMath math="f_{NA}" />)
                                            {zone?.heatingReducedMode === "shutdown"
                                                ? <span className="ml-1 text-[10px] text-red-500">(Shutdown)</span>
                                                : <span className="ml-1 text-[10px] text-blue-500">(Setback)</span>
                                            }
                                        </div>
                                        <div className="text-xl font-bold">{formatNum(f_NA, 3)}</div>
                                    </div>
                                    <div className="text-right bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">
                                        <div className="text-[10px] text-slate-400 mb-0.5">적응 제어 (<InlineMath math="f_{adapt}" />)</div>
                                        <div className="text-sm font-semibold text-slate-700">{currentMonthData.f_adapt}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400">
                                    {zone?.heatingReducedMode === "shutdown" ? (
                                        <InlineMath math="f_{NA} = 0.26 \cdot \frac{t_{NA}}{24} \cdot \exp(-\frac{\tau}{250}) \cdot f_{adapt}" />
                                    ) : (
                                        <InlineMath math="f_{NA} = 0.13 \cdot \frac{t_{NA}}{24} \cdot \exp(-\frac{\tau}{250}) \cdot f_{adapt}" />
                                    )}
                                </div>
                            </div>
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1">
                                            주말 감경 계수 (<InlineMath math="f_{we}" />)
                                            {zone?.heatingReducedMode === "shutdown"
                                                ? <span className="ml-1 text-[10px] text-red-500">(Shutdown)</span>
                                                : <span className="ml-1 text-[10px] text-blue-500">(Setback)</span>
                                            }
                                        </div>
                                        <div className="text-xl font-bold">{formatNum(f_we, 3)}</div>
                                    </div>
                                    {/* Empty placeholder to match height/layout if needed, or just kept for consistency structure */}
                                    <div className="text-right px-2 py-1 h-[38px]">
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400">
                                    {zone?.heatingReducedMode === "shutdown" ? (
                                        <InlineMath math="f_{we} = 0.3 \cdot (1 - 0.2 \cdot \frac{\tau}{250})" />
                                    ) : (
                                        <InlineMath math="f_{we} = 0.2 \cdot (1 - 0.4 \cdot \frac{\tau}{250})" />
                                    )}
                                </div>
                            </div>

                        </div>
                    </section>

                    {/* Step 3: Effective Temperature (Heating & Cooling) */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-sm">Step 3</span>
                                유효 실내 온도 산정 (Effective Temperature)
                            </h3>
                        </div>

                        {/* 3-1. Heating Effective Temperature */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Operation (Usage Days) */}
                            <div className="rounded-xl border bg-slate-50/50 p-5 flex flex-col h-full">
                                <div className="flex items-center justify-between border-b pb-2 mb-4">
                                    <h4 className="font-semibold text-sm">사용일 (Usage Days)</h4>
                                    <span className="text-xs font-mono bg-white border px-2 py-1 rounded">일일 감경 (Daily Setback)</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                    <div className="space-y-1">
                                        <div className="text-muted-foreground text-xs">기본 설정 (<InlineMath math="\theta_{int,H}" />)</div>
                                        <div className="font-medium">{formatNum(Theta_int_set, 1)} °C</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-muted-foreground text-xs">야간 감경 계수 (<InlineMath math="f_{NA}" />)</div>
                                        <div className="font-medium">{formatNum(f_NA, 3)}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-muted-foreground text-xs">제어 보정 (<InlineMath math="\Delta \theta_{EMS}" />)</div>
                                        <div className="font-medium">{formatNum(delta_theta_EMS, 2)} K</div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs text-muted-foreground">
                                            <InlineMath math="\theta_{i,h,op}" />
                                        </div>
                                        <div className="text-2xl font-bold text-red-600">
                                            {formatNum(currentMonthData.Theta_i_h_op || Theta_i_real, 2)} <span className="text-sm text-muted-foreground font-normal">°C</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 text-right mt-1">
                                        <InlineMath math="\theta_{i,h,op} = \max \left( (\theta_{int,H} + \Delta \theta_{EMS}) - f_{NA}(\theta_{int,H} - \theta_e), \quad \theta_{int,H} - \Delta \theta_{red} \frac{t_{red}}{24} \right)" />
                                    </div>
                                </div>
                            </div>

                            {/* Non-Operation (Weekends/Holidays) */}
                            <div className="rounded-xl border bg-slate-50/50 p-5 flex flex-col h-full">
                                <div className="flex items-center justify-between border-b pb-2 mb-4">
                                    <h4 className="font-semibold text-sm">비사용일 (Non-Usage Days)</h4>
                                    <span className="text-xs font-mono bg-white border px-2 py-1 rounded">주말 감경 (Weekend Setback)</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                    <div className="space-y-1">
                                        <div className="text-muted-foreground text-xs">기본 설정 (<InlineMath math="\theta_{int,H}" />)</div>
                                        <div className="font-medium">{formatNum(Theta_int_set, 1)} °C</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-muted-foreground text-xs">주말 감경 계수 (<InlineMath math="f_{we}" />)</div>
                                        <div className="font-medium">{formatNum(f_we, 3)}</div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs text-muted-foreground">
                                            <InlineMath math="\theta_{i,h,non-op}" />
                                        </div>
                                        <div className="text-2xl font-bold text-red-600">
                                            {currentMonthData.avg_Ti_non_op
                                                ? formatNum(currentMonthData.avg_Ti_non_op, 2)
                                                : <span className="text-base text-muted-foreground">N/A</span>}
                                            {currentMonthData.avg_Ti_non_op && <span className="text-sm text-muted-foreground font-normal"> °C</span>}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 text-right mt-1">
                                        <InlineMath math="\theta_{i,h,we} = \max \left( \theta_{int,H} - f_{we}(\theta_{int,H} - \theta_e), \quad \theta_{int,H} - \Delta \theta_{red} \right)" />
                                    </div>
                                </div>
                            </div>

                            {/* Weighted Average Summary */}
                            <div className="md:col-span-2 rounded-xl border-2 border-red-100 bg-red-50 p-4 flex flex-col gap-3">
                                <div className="flex flex-row items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-red-900">난방 유효 실내 온도 (Weighted Average)</h4>
                                        <div className="text-xs text-red-700 flex flex-col gap-0.5">
                                            <span>기간 가중 평균: <InlineMath math="\theta_{i,h}" /></span>
                                            <span className="text-red-600/80">
                                                (사용일수 <InlineMath math="d_{op}" />: {formatNum(currentMonthData.d_nutz || 0, 1)}일,
                                                비사용일수 <InlineMath math="d_{we}" />: {formatNum(currentMonthData.d_we || 0, 1)}일)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-red-600">
                                        {formatNum(Theta_i_real, 2)} <span className="text-lg text-red-400 font-normal">°C</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-red-200 w-full text-center text-sm text-red-600/80">
                                    <InlineMath math="\theta_{i,h} = \frac{\theta_{i,h,op} \cdot d_{op} + \theta_{i,h,we} \cdot d_{we}}{d_{op} + d_{we}}" />
                                </div>
                            </div>
                        </div>

                        {/* 3-2. Cooling Effective Temperature */}
                        <div className="rounded-xl border-2 border-cyan-100 bg-cyan-50 p-4 flex flex-col gap-3 shadow-sm">
                            <div className="flex flex-row items-center justify-between">
                                <div className="space-y-1">
                                    <h4 className="font-semibold text-cyan-900">냉방 유효 실내 온도 (Cooling Effective Temp)</h4>
                                    <div className="text-xs text-cyan-700 flex flex-col gap-0.5">
                                        <span>
                                            냉방 설정 온도 (<InlineMath math="\theta_{int,C}" />): <strong>{formatNum(currentMonthData.Theta_int_C, 1)}°C</strong>
                                        </span>
                                        <span className="text-cyan-600/80">단순 감경 적용: -2.0 K</span>
                                    </div>
                                </div>
                                <div className="text-3xl font-bold text-cyan-600">
                                    {formatNum((currentMonthData.Theta_int_C || 26) - 2.0, 2)} <span className="text-lg text-cyan-400 font-normal">°C</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-cyan-200 w-full text-center text-sm text-cyan-600/80">
                                <InlineMath math="\theta_{i,c} = \theta_{int,C} - 2.0" />
                            </div>
                        </div>

                    </section>

                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
