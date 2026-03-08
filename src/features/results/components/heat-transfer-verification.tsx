"use client";

import React from "react";
import { MonthlyResult } from "@/engine/types";
import { Zone } from "@/types/project";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VerificationSection } from "./shared/verification-ui";

interface HeatTransferVerificationProps {
    data: MonthlyResult[];
    zone?: Zone;
}

export function HeatTransferVerification({ data, zone }: HeatTransferVerificationProps) {
    if (!data || data.length === 0) return null;

    const formatNum = (num: number | undefined, decimals: number = 2) => {
        if (num === undefined || isNaN(num)) return "-";
        return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    const getAvg = (arr: any[], key: string) =>
        arr.length > 0 ? arr.reduce((sum, d) => sum + (d[key] || 0), 0) / arr.length : 0;

    const heatingMonthNumbers = [1, 2, 3, 4, 5, 10, 11, 12];
    const coolingMonthNumbers = [6, 7, 8, 9];
    const hData = data.filter(d => heatingMonthNumbers.includes(d.month));
    const cData = data.filter(d => coolingMonthNumbers.includes(d.month));

    const currentMonthDataRaw = data[0]; // For static properties like areas

    return (
        <div className="space-y-6">
            {/* 1. Transmission Summary */}
            <VerificationSection title="1. 관류 열전달계수 상세 (Transmission H_tr Breakdown)" description="외피 유형별/방위별 열전달계수 산정 근거 (고정값 기준)">
                <Table className="text-xs">
                    <TableHeader>
                        <TableRow className="bg-orange-50/50">
                            <TableHead className="w-[150px]">부위 (Surface)</TableHead>
                            <TableHead className="text-right">면적 A (m²)</TableHead>
                            <TableHead className="text-right">열관류율 U (W/m²K)</TableHead>
                            <TableHead className="text-right">보정계수 f_x (-)</TableHead>
                            <TableHead className="text-right">ΔU_WB (W/m²K)</TableHead>
                            <TableHead className="text-right">H_surf (W/K)</TableHead>
                            <TableHead className="text-right">H_bridge (W/K)</TableHead>
                            <TableHead className="text-right font-bold border-l">H_tr (W/K)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentMonthDataRaw.transmissionBySurface && Object.entries(currentMonthDataRaw.transmissionBySurface).map(([key, surf]) => {
                            const h_tr = surf.H_tr + surf.H_bridge;
                            return (
                                <TableRow key={key} className="hover:bg-slate-50/50">
                                    <TableCell className="font-medium text-slate-700">{surf.name}</TableCell>
                                    <TableCell className="text-right font-mono">{formatNum(surf.area, 1)}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(surf.uValue, 2)}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(surf.fx, 2)}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-400 italic">+{formatNum(surf.delta_U_WB || 0, 3)}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(surf.H_tr, 1)}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-400">{formatNum(surf.H_bridge, 1)}</TableCell>
                                    <TableCell className="text-right font-mono font-bold bg-slate-50/30 border-l">{formatNum(h_tr, 1)}</TableCell>
                                </TableRow>
                            );
                        })}
                        <TableRow className="bg-slate-50 font-bold border-t-2">
                            <TableCell colSpan={7} className="text-right">합계 Σ H_tr (Transmission)</TableCell>
                            <TableCell className="text-right font-mono text-orange-700 text-sm border-l">{formatNum(currentMonthDataRaw.H_tr_total, 1)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </VerificationSection>

            {/* 2. Ventilation Summary */}
            <VerificationSection title="2. 환기 열전달계수 상세 (Ventilation H_ve Breakdown)" description="난방/냉방 모드별 열전달계수 및 주요 인자 (연간 평균값)">
                <div className="space-y-8">
                    {/* 2.0. 공통 기본 입력값 */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-sm text-green-700">2.0 공통 기본 입력값</h3>
                        <Table className="text-xs border">
                            <TableHeader>
                                <TableRow className="bg-gray-50/80">
                                    <TableHead className="w-[110px]">구분</TableHead>
                                    <TableHead className="text-right">A_NGF (m²)</TableHead>
                                    <TableHead className="text-right">h_R (m)</TableHead>
                                    <TableHead className="text-right">V (m³)</TableHead>
                                    <TableHead className="text-right">V̇_A (m³/hm²)</TableHead>
                                    <TableHead className="text-right">n_nutz (1/h)</TableHead>
                                    <TableHead className="text-right">n_50 (1/h)</TableHead>
                                    <TableHead className="text-right">f_ATD (-)</TableHead>
                                    <TableHead className="text-right">n_SUP (1/h)</TableHead>
                                    <TableHead className="text-right">n_ETA (1/h)</TableHead>
                                    <TableHead className="text-right">η_rec (%)</TableHead>
                                    <TableHead className="text-right">t_V,m (h/d)</TableHead>
                                    <TableHead className="text-right">t_nutz (h/d)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell>난방 평균</TableCell>
                                    <TableCell className="text-right">{formatNum(hData[0]?.A_NGF, 1)}</TableCell>
                                    <TableCell className="text-right">{formatNum(hData[0]?.roomHeight, 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(hData[0]?.V_net, 1)}</TableCell>
                                    <TableCell className="text-right">{formatNum(hData[0]?.min_outdoor_airflow, 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'n_nutz'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'n50'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'f_ATD'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'n_SUP'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'n_ETA'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'heatRecoveryEff') * 100, 0)}%</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 't_v_mech'), 1)}</TableCell>
                                    <TableCell className="text-right">{formatNum(hData[0]?.t_nutz, 1)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>냉방 평균</TableCell>
                                    <TableCell className="text-right">{formatNum(cData[0]?.A_NGF, 1)}</TableCell>
                                    <TableCell className="text-right">{formatNum(cData[0]?.roomHeight, 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(cData[0]?.V_net, 1)}</TableCell>
                                    <TableCell className="text-right">{formatNum(cData[0]?.min_outdoor_airflow, 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'n_nutz'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'n50'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'f_ATD'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'n_SUP'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'n_ETA'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'heatRecoveryEff') * 100, 0)}%</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 't_v_mech'), 1)}</TableCell>
                                    <TableCell className="text-right">{formatNum(cData[0]?.t_nutz, 1)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    {/* 2.1~2.3 통합 상세 */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-sm text-green-700">2.1~2.3 환기 산정 통합 상세</h3>
                        <Table className="text-xs border">
                            <TableHeader>
                                <TableRow className="bg-green-50/50">
                                    <TableHead rowSpan={2} className="w-[100px] align-bottom">구분</TableHead>
                                    <TableHead className="text-center border-l bg-amber-50/30" colSpan={3}>2.1 침기 (Infiltration)</TableHead>
                                    <TableHead className="text-center border-l bg-sky-50/30" colSpan={4}>2.2 창문환기 (Window)</TableHead>
                                    <TableHead className="text-center border-l bg-violet-50/30" colSpan={1}>2.3 기계환기</TableHead>
                                    <TableHead rowSpan={2} className="text-right font-bold text-blue-700 bg-blue-50/20 align-bottom">H_ve,τ (W/K)</TableHead>
                                </TableRow>
                                <TableRow className="bg-green-50/30">
                                    <TableHead className="text-right border-l bg-amber-50/20">f_e</TableHead>
                                    <TableHead className="text-right bg-amber-50/20">n_inf</TableHead>
                                    <TableHead className="text-right bg-amber-50/20">f_e</TableHead>
                                    <TableHead className="text-right border-l bg-sky-50/20">n_win,min</TableHead>
                                    <TableHead className="text-right bg-sky-50/20">Δn_win</TableHead>
                                    <TableHead className="text-right bg-sky-50/20">Δn_win,m</TableHead>
                                    <TableHead className="text-right bg-sky-50/20">n_win</TableHead>
                                    <TableHead className="text-right border-l bg-violet-50/20">n_mech</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-bold text-red-600">난방</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(hData, 'f_e'), 2)}</TableCell>
                                    <TableCell className="text-right font-bold text-amber-700">{formatNum(getAvg(hData, 'n_inf'), 3)}</TableCell>
                                    <TableCell className="text-right">-</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(hData, 'n_win_min'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'Delta_n_win'), 3)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'Delta_n_win_mech'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-sky-700">{formatNum(getAvg(hData, 'n_win'), 3)}</TableCell>
                                    <TableCell className="text-right border-l font-bold text-violet-700">{formatNum(getAvg(hData, 'n_mech'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-blue-700 bg-blue-50/10">{formatNum(getAvg(hData, 'H_ve_tau_h'), 1)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold text-blue-600">냉방</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(cData, 'f_e'), 2)}</TableCell>
                                    <TableCell className="text-right font-bold text-amber-700">{formatNum(getAvg(cData, 'n_inf'), 3)}</TableCell>
                                    <TableCell className="text-right">-</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(cData, 'n_win_min'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'Delta_n_win'), 3)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'Delta_n_win_mech'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-sky-700">{formatNum(getAvg(cData, 'n_win'), 3)}</TableCell>
                                    <TableCell className="text-right border-l font-bold text-violet-700">{formatNum(getAvg(cData, 'n_mech'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-blue-700 bg-blue-50/10">{formatNum(getAvg(cData, 'H_ve_tau_c'), 1)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </VerificationSection>
        </div>
    );
}
