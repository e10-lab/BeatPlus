"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InlineMath } from "react-katex";
import { VerificationSection } from "../shared/verification-ui";

interface LossAssumptionsSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function LossAssumptionsSection({ isExpanded, onToggle }: LossAssumptionsSectionProps) {
  return (
    <VerificationSection 
      title="시스템 손실 기본값 가정 (Default System Loss Assumptions)"
      collapsible
      isExpanded={isExpanded}
      onToggle={onToggle}
      className="mt-8 border-orange-100"
    >
      <div className="text-sm text-slate-600 mb-4 bg-orange-50/50 p-3 rounded border border-orange-100">
        초기 설계 단계에서 설비 상세 정보(배관 길이, 버퍼 탱크 용량 등)가 입력되지 않은 경우, <strong>DIN V 18599</strong> 표준에 근거하여 아래와 같은 기본값을 자동 적용합니다.
      </div>
      <div className="rounded-md border border-orange-100 overflow-hidden bg-white">
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
    </VerificationSection>
  );
}
