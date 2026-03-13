"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap } from "lucide-react";
import { Latex } from "@/components/ui/latex";
import { formatNum } from "../../utils/formatters";
import { VerificationSection, MathTooltip } from "../shared/verification-ui";

interface LightingSectionProps {
  currentMonthData: any;
  zone: any;
  profile: any;
  isExpanded: boolean;
  onToggle: () => void;
}

export function LightingSection({
  currentMonthData,
  zone,
  profile,
  isExpanded,
  onToggle
}: LightingSectionProps) {
  return (
    <VerificationSection 
      step="Step 4" 
      title="조명 요구량 및 열획득 상세 (Lighting Verification)"
      collapsible
      isExpanded={isExpanded}
      onToggle={onToggle}
      rightElement={<div className="text-yellow-700 font-bold text-sm">{formatNum(currentMonthData.Q_l_b, 1)} kWh/월</div>}
      className="border-yellow-100"
    >
      <div className="rounded-md border border-yellow-100 overflow-hidden bg-white">
        <Table className="text-xs">
          <TableHeader className="bg-yellow-50/50 text-yellow-900">
            <TableRow className="hover:bg-transparent border-b-yellow-100">
              <TableHead className="w-24 text-slate-600">구분 (Item)</TableHead>
              <TableHead className="text-right">
                <MathTooltip math="A" title="조명 부하 산정의 기준이 되는 존의 유효 가동 바닥 면적 (Nettofläche)" className="text-yellow-900 font-semibold">면적 (m²)</MathTooltip>
              </TableHead>
              <TableHead className="text-right">
                <MathTooltip math="E_m" title="DIN/TS 18599-10:2025-10/Profiles에 따른 요구 유지조도 레벨" className="text-yellow-900 font-semibold">조도 (lx)</MathTooltip>
              </TableHead>
              <TableHead className="text-right">
                <MathTooltip math="P_{inst}" title="설치 조명 설비의 전력량 밀도 ($100 \\text{lx}$ 당 $W/m^2$ 기반 산출)" className="text-yellow-900 font-semibold">밀도 (W/m²)</MathTooltip>
              </TableHead>
              <TableHead className="text-right">
                <MathTooltip math="t_{occ}" title="해당 존의 일간 조명 가동(재실) 시간" className="text-yellow-900 font-semibold">시간 (h/d)</MathTooltip>
              </TableHead>
              <TableHead className="text-right font-bold">요구량 (<Latex formula="Q_{l,b}" />) (kWh)</TableHead>
              <TableHead className="text-right font-bold text-orange-600">열획득 (<Latex formula="Q_{I,l}" />) (kWh)</TableHead>
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
            <Latex formula="Q_{l,b} = P_{inst} \cdot A \cdot t_{occ} \cdot d_{mth} \cdot 10^{-3}" />
            <div className="w-px h-3 bg-slate-300" />
            <Latex formula="Q_{I,l} = Q_{l,b} \cdot 1.0" />
          </div>
          <div className="text-[10px] text-slate-400 italic mt-1.5 leading-relaxed">
            조명 에너지 요구량 및 실내 열획득 산정 (100% Heat Gain Factor 적용)
          </div>
        </div>
      </div>
    </VerificationSection>
  );
}
