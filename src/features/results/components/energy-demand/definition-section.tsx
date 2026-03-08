"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InlineMath } from "react-katex";
import { VerificationSection } from "../shared/verification-ui";

interface DefinitionSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function DefinitionSection({ isExpanded, onToggle }: DefinitionSectionProps) {
  return (
    <VerificationSection 
      step="Step 6" 
      title="주요 파라미터 정의 (Parameter Definitions)"
      collapsible
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
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
            {[
              { symbol: "\\tau", desc: "시간 상수 (Time Constant). 건물의 열적 관성을 나타내며, 유효 열용량(C_m)과 총 전열계수(H)의 비로 계산.", unit: "h", source: "DIN/TS 18599-2" },
              { symbol: "\\gamma", desc: "이득/손실 비 (Gain-Loss Ratio). 열획득 총합(Q_{source})과 열손실 총합(Q_{sink})의 비율.", unit: "-", source: "DIN/TS 18599-2" },
              { symbol: "Q_{h,b}", desc: "난방 에너지 요구량 (Heating Demand). 건물의 설계 온도를 유지하기 위해 필요한 열에너지.", unit: "kWh/월", source: "DIN/TS 18599-2" },
              { symbol: "Q_{c,b}", desc: "냉방 에너지 요구량 (Cooling Demand). 건물을 냉각하기 위해 제거해야 할 총 열량.", unit: "kWh/월", source: "DIN/TS 18599-2" },
              { symbol: "Q_{l,b}", desc: "조명 에너지 요구량 (Lighting Demand). 조명 설비 가동을 위해 필요한 총 전기 에너지 소비량.", unit: "kWh/월", source: "DIN/TS 18599-4" },
              { symbol: "Q_{w,b}", desc: "급탕 에너지 요구량 (DHW Demand). 건물의 온수 소비를 충족하기 위해 필요한 열에너지.", unit: "kWh/월", source: "DIN/TS 18599-8" },
              { symbol: "Q_{I,p}", desc: "재실자 내부 열획득 (Occupancy Gain). 사람의 신진대사로 인해 실내로 방출되는 열량.", unit: "kWh/월", source: "DIN/TS 18599-10" },
              { symbol: "Q_{I,l}", desc: "조명 내부 열획득 (Lighting Heat Gain). 조명 기구에서 실내로 유입되는 열량.", unit: "kWh/월", source: "DIN/TS 18599-4" },
              { symbol: "Q_{I,fac}", desc: "기기 내부 열획득 (Equipment Gain). 전자기기 및 설비의 가동으로 인해 발생하는 열량.", unit: "kWh/월", source: "DIN/TS 18599-10" },
              { symbol: "Q_{I,w}", desc: "급탕 시스템 내부 열획득 (DHW Heat Gain). 온수 시스템 손실 중 실내로 유입되는 열량.", unit: "kWh/월", source: "DIN/TS 18599-8" }
            ].map((row, idx) => (
              <TableRow key={idx} className="hover:bg-slate-50/50">
                <TableCell className="font-mono font-bold"><InlineMath math={row.symbol} /></TableCell>
                <TableCell>{row.desc}</TableCell>
                <TableCell className="text-center font-mono">{row.unit}</TableCell>
                <TableCell className="text-muted-foreground italic">{row.source}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 p-3 bg-slate-50 rounded text-[10px] text-slate-500 italic">
        * 모든 계산은 DIN/TS 18599:2025-10 표준 방법론을 준수합니다.
      </div>
    </VerificationSection>
  );
}
