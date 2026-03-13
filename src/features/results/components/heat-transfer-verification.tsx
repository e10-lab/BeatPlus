"use client";

import React from "react";
import { MonthlyResult } from "@/engine/types";
import { Zone } from "@/types/project";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VerificationSection } from "./shared/verification-ui";
import { Latex } from "@/components/ui/latex";
import { formatNum } from "../utils/formatters";

interface HeatTransferVerificationProps {
    data: MonthlyResult[];
    zone?: Zone;
}

export function HeatTransferVerification({ data, zone }: HeatTransferVerificationProps) {
    if (!data || data.length === 0) return null;

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
            <VerificationSection 
                title={<>1. 관류 열전달계수 상세 (Transmission <Latex formula="H_{tr}" /> Breakdown)</>} 
                description="외피 유형별/방위별 열전달계수 산정 근거 (고정값 기준)"
            >
                <Table className="text-xs">
                    <TableHeader>
                        <TableRow className="bg-orange-50/50">
                            <TableHead className="w-[150px]">부위 (Surface)</TableHead>
                            <TableHead className="text-right">면적 <Latex formula="A" /> (m²)</TableHead>
                            <TableHead className="text-right">열관류율 <Latex formula="U" /> (W/m²K)</TableHead>
                            <TableHead className="text-right">보정계수 <Latex formula="f_x" /> (-)</TableHead>
                            <TableHead className="text-right"><Latex formula="\Delta U_{WB}" /> (W/m²K)</TableHead>
                            <TableHead className="text-right"><Latex formula="H_{surf}" /> (W/K)</TableHead>
                            <TableHead className="text-right"><Latex formula="H_{bridge}" /> (W/K)</TableHead>
                            <TableHead className="text-right font-bold border-l"><Latex formula="H_{tr}" /> (W/K)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentMonthDataRaw.transmissionBySurface && Object.entries(currentMonthDataRaw.transmissionBySurface).map(([key, surf]) => {
                            const h_tr = surf.H_tr + surf.H_bridge;
                            return (
                                <TableRow key={key} className="hover:bg-slate-50/50">
                                    <TableCell className="font-medium text-slate-700">{surf.name}</TableCell>
                                    <TableCell className="text-right font-mono">{formatNum(surf.area, 1)}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(surf.uValue, 3)}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(surf.fx, 3)}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-400 italic">+{formatNum(surf.delta_U_WB || 0, 3)}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-500">{formatNum(surf.H_tr, 1)}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-400">{formatNum(surf.H_bridge, 1)}</TableCell>
                                    <TableCell className="text-right font-mono font-bold bg-slate-50/30 border-l">{formatNum(h_tr, 1)}</TableCell>
                                </TableRow>
                            );
                        })}
                        <TableRow className="bg-indigo-50/30 font-bold">
                            <TableCell colSpan={7} className="text-right text-indigo-700">합계 <Latex formula="\Sigma H_{tr,\tau}" /> (Time Constant)</TableCell>
                            <TableCell className="text-right font-mono text-indigo-700 text-sm border-l">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>{formatNum(currentMonthDataRaw.H_tr_tau, 1)}</TooltipTrigger>
                                        <TooltipContent className="text-[10px]">내부 부재 Fx=0.5 보정 반영 (DIN 18599-2)</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </VerificationSection>

            {/* 2. Ventilation Summary */}
            <VerificationSection 
                title={<>2. 환기 열전달계수 상세 (Ventilation <Latex formula="H_{ve}" /> Breakdown)</>} 
                description="난방/냉방 모드별 열전달계수 및 주요 인자 (연간 평균값)"
            >
                <div className="space-y-8">
                    {/* 2.0. 공통 기본 입력값 */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-sm text-green-700">2.0 공통 기본 입력값</h3>
                        <Table className="text-xs border">
                            <TableHeader>
                                <TableRow className="bg-gray-50/80">
                                    <TableHead className="w-[110px]">구분</TableHead>
                                    <TableHead className="text-right"><Latex formula="A_{NGF}" /> (m²)</TableHead>
                                    <TableHead className="text-right"><Latex formula="h_R" /> (m)</TableHead>
                                    <TableHead className="text-right"><Latex formula="V" /> (m³)</TableHead>
                                    <TableHead className="text-right"><Latex formula="\dot{V}_A" /> (m³/hm²)</TableHead>
                                    <TableHead className="text-right"><Latex formula="n_{nutz}" /> (1/h)</TableHead>
                                    <TableHead className="text-right"><Latex formula="n_{50}" /> (1/h)</TableHead>
                                    <TableHead className="text-right"><Latex formula="f_{ATD}" /> (-)</TableHead>
                                    <TableHead className="text-right"><Latex formula="n_{SUP}" /> (1/h)</TableHead>
                                    <TableHead className="text-right"><Latex formula="n_{ETA}" /> (1/h)</TableHead>
                                    <TableHead className="text-right"><Latex formula="\eta_{rec}" /> (%)</TableHead>
                                    <TableHead className="text-right"><Latex formula="t_{V,m}" /> (h/d)</TableHead>
                                    <TableHead className="text-right"><Latex formula="t_{nutz}" /> (h/d)</TableHead>
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
                        <h3 className="font-bold text-sm text-green-700">2.1~2.3 환기 산정 통합 상세 [v3.3]</h3>
                        <Table className="text-xs border">
                            <TableHeader>
                                <TableRow className="bg-green-50/50">
                                    <TableHead rowSpan={2} className="w-[100px] align-bottom">구분</TableHead>
                                    <TableHead className="text-center border-l bg-amber-50/30" colSpan={3}>2.1 침기 (Infiltration)</TableHead>
                                    <TableHead className="text-center border-l bg-sky-50/30" colSpan={4}>2.2 창문환기 (Window)</TableHead>
                                    <TableHead className="text-center border-l bg-violet-50/30" colSpan={1}>2.3 기계환기</TableHead>
                                    <TableHead rowSpan={2} className="text-right font-bold text-blue-700 bg-blue-50/20 align-bottom">
                                        <div className="flex flex-col items-end">
                                            <span><Latex formula="H_{ve,\tau}" /></span>
                                            <span className="text-[10px] font-normal text-slate-400">Physical Daily (W/K)</span>
                                        </div>
                                    </TableHead>
                                </TableRow>
                                <TableRow className="bg-green-50/30">
                                    <TableHead className="text-right border-l bg-amber-50/20"><Latex formula="f_e" /></TableHead>
                                    <TableHead className="text-right bg-amber-50/20"><Latex formula="n_{inf}" /></TableHead>
                                    <TableHead className="text-right bg-amber-50/20"><Latex formula="e" /></TableHead>
                                    <TableHead className="text-right border-l bg-sky-50/20"><Latex formula="n_{win,min}" /></TableHead>
                                    <TableHead className="text-right bg-sky-50/20"><Latex formula="\Delta n_{win}" /></TableHead>
                                    <TableHead className="text-right bg-sky-50/20"><Latex formula="\Delta n_{win,m}" /></TableHead>
                                    <TableHead className="text-right bg-sky-50/20"><Latex formula="n_{win}" /></TableHead>
                                    <TableHead className="text-right border-l bg-violet-50/20"><Latex formula="n_{mech}" /></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-bold text-red-600">난방 (Usage)</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(hData, 'f_e'), 2)}</TableCell>
                                    <TableCell className="text-right font-bold text-amber-700">{formatNum(getAvg(hData, 'n_inf_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'e_shield'), 3)}</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(hData, 'n_win_min'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'Delta_n_win'), 3)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'Delta_n_win_mech'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-sky-700">{formatNum(getAvg(hData, 'n_win_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right border-l font-bold text-violet-700">{formatNum(getAvg(hData, 'n_mech_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-blue-700 bg-blue-50/10">
                                        <div className="flex flex-col items-end">
                                            <span>{formatNum(getAvg(hData, 'H_ve_tau_h_op'), 1)}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold text-slate-500">난방 (Non-Op)</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(hData, 'f_e'), 2)}</TableCell>
                                    <TableCell className="text-right font-bold text-amber-700">{formatNum(getAvg(hData, 'n_inf_non_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'e_shield'), 3)}</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(hData, 'n_win_min'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'Delta_n_win'), 3)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(hData, 'Delta_n_win_mech'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-sky-700">{formatNum(getAvg(hData, 'n_win_non_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right border-l font-bold text-violet-700">{formatNum(getAvg(hData, 'n_mech_non_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-slate-500 bg-slate-50/10">
                                        <div className="flex flex-col items-end">
                                            <span>{formatNum(getAvg(hData, 'H_ve_tau_h_non_op'), 1)}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold text-blue-600">냉방 (Usage)</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(cData, 'f_e'), 2)}</TableCell>
                                    <TableCell className="text-right font-bold text-amber-700">{formatNum(getAvg(cData, 'n_inf_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'e_shield'), 3)}</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(cData, 'n_win_min'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'Delta_n_win'), 3)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'Delta_n_win_mech'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-sky-700">{formatNum(getAvg(cData, 'n_win_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right border-l font-bold text-violet-700">{formatNum(getAvg(cData, 'n_mech_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-blue-700 bg-blue-50/10">
                                        <div className="flex flex-col items-end">
                                            <span>{formatNum(getAvg(cData, 'H_ve_tau_c_op'), 1)}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold text-slate-500">냉방 (Non-Op)</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(cData, 'f_e'), 2)}</TableCell>
                                    <TableCell className="text-right font-bold text-amber-700">{formatNum(getAvg(cData, 'n_inf_non_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'e_shield'), 3)}</TableCell>
                                    <TableCell className="text-right border-l">{formatNum(getAvg(cData, 'n_win_min'), 2)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'Delta_n_win'), 3)}</TableCell>
                                    <TableCell className="text-right">{formatNum(getAvg(cData, 'Delta_n_win_mech'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-sky-700">{formatNum(getAvg(cData, 'n_win_non_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right border-l font-bold text-violet-700">{formatNum(getAvg(cData, 'n_mech_non_op_phys'), 3)}</TableCell>
                                    <TableCell className="text-right font-bold text-slate-500 bg-slate-50/10">
                                        <div className="flex flex-col items-end">
                                            <span>{formatNum(getAvg(cData, 'H_ve_tau_c_non_op'), 1)}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </VerificationSection>

        </div>
    );
}
