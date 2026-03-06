"use client";

import { useState } from "react";
import { MonthlyResult } from "@/engine/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight, Flame, Droplets, Zap, Thermometer, PipetteIcon, Database, BarChart3 } from "lucide-react";
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface SystemVerificationProps {
    data: MonthlyResult[];
    title?: string;
}

/** 숫자 포맷: 소수점 유연 처리 */
function fmt(v: number | undefined | null, dp = 1): string {
    if (v === undefined || v === null || isNaN(v)) return "-";
    return v.toFixed(dp);
}

/** KaTeX 수식 + 단위 + 툴팁(설명+계산식) 조합 헬퍼 */
function K({ math, unit, tip, formula }: { math: string; unit?: string; tip?: string; formula?: string }) {
    const inner = (
        <span className={`whitespace-nowrap ${tip ? "cursor-help decoration-dotted underline underline-offset-2" : ""}`}>
            <InlineMath math={math} />
            {unit && <span className="text-[10px] ml-0.5 normal-case">{unit}</span>}
        </span>
    );

    if (!tip) return inner;

    return (
        <Tooltip>
            <TooltipTrigger asChild>{inner}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-[420px] text-xs p-3">
                <p className="font-bold mb-1"><InlineMath math={math} /></p>
                <p className="text-muted-foreground mb-1.5">{tip}</p>
                {formula && (
                    <div className="border-t pt-1.5 mt-1 overflow-x-auto">
                        <BlockMath math={formula} />
                    </div>
                )}
            </TooltipContent>
        </Tooltip>
    );
}

/** Accordion 섹션 컴포넌트 */
function Section({
    title,
    icon,
    iconColor,
    defaultOpen = false,
    children,
}: {
    title: React.ReactNode;
    icon: React.ReactNode;
    iconColor: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Card className="overflow-hidden">
            <button
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${iconColor}`}>{icon}</div>
                    <span className="font-semibold text-sm">{title}</span>
                </div>
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {open && <CardContent className="px-0 py-0">{children}</CardContent>}
        </Card>
    );
}

/** 공통 테이블 래퍼 */
function DataTable({ headers, children }: { headers: React.ReactNode[]; children: React.ReactNode }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-right first:text-left whitespace-nowrap font-medium">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y">{children}</tbody>
            </table>
        </div>
    );
}

function Td({ children, className = "", wrap = false }: { children: React.ReactNode; className?: string; wrap?: boolean }) {
    return <td className={`px-3 py-1.5 text-right first:text-left ${wrap ? "whitespace-normal break-keep" : "whitespace-nowrap"} ${className}`}>{children}</td>;
}

export function SystemVerification({ data, title }: SystemVerificationProps) {
    const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

    // 연간 합계 계산 헬퍼
    const sumField = (fn: (m: MonthlyResult) => number) => data.reduce((s, m) => s + fn(m), 0);

    return (
        <TooltipProvider delayDuration={200}>
        <div className="space-y-3">
            {title && (
                <h3 className="text-lg font-bold tracking-tight">{title}</h3>
            )}
            <p className="text-sm text-muted-foreground mb-4">
                DIN/TS 18599-5 (난방) 및 DIN/TS 18599-8 (급탕) 기반 설비 손실 상세 검증
            </p>

            {/* ── 섹션 1: 난방 운전 조건 ── */}
            <Section
                title={<>1. 난방 운전 조건 <span className="text-muted-foreground font-normal">(DIN/TS 18599-5 §5)</span></>}
                icon={<Thermometer className="h-4 w-4 text-white" />}
                iconColor="bg-orange-500"
                defaultOpen={true}
            >
                <DataTable headers={[
                    "월",
                    <K key="b" math="\beta" tip="난방 부하율 — 현재 부하 / 설계 부하"
                       formula="\beta = \frac{\Phi_h}{\Phi_{h,max}}" />,
                    <K key="vl" math="\theta_{VL}" unit="(°C)" tip="공급 온도 — 보일러에서 나가는 물의 온도"
                       formula="\theta_{VL} = \theta_{HK,av} + \frac{\Delta\theta_{HK}}{2}" />,
                    <K key="rl" math="\theta_{RL}" unit="(°C)" tip="환수 온도 — 방열기에서 돌아오는 물의 온도"
                       formula="\theta_{RL} = \theta_{HK,av} - \frac{\Delta\theta_{HK}}{2}" />,
                    <K key="hk" math="\theta_{HK,av}" unit="(°C)" tip="평균 운전 온도 — 공급/환수 온도의 산술 평균"
                       formula="\theta_{HK,av} = \frac{\theta_{VL} + \theta_{RL}}{2}" />,
                    <K key="t" math="t_{h,rL}" unit="(h)" tip="난방 가동 시간 — 운전 모드에 따른 월간 총 가동 시간"
                       formula="t_{h,rL} = t_{op} + t_{non\text{-}op} \cdot f_{rL}" />,
                ]}>
                    {data.map((m, i) => (
                        <tr key={m.month} className="hover:bg-muted/10">
                            <Td className="font-medium">{MONTHS[i]}</Td>
                            <Td>{fmt(m.beta_h_ce, 3)}</Td>
                            <Td>{fmt(m.theta_VL)}</Td>
                            <Td>{fmt(m.theta_RL)}</Td>
                            <Td className="font-semibold text-orange-600">{fmt(m.theta_HK_av)}</Td>
                            <Td>{fmt(m.t_h_rL, 0)}</Td>
                        </tr>
                    ))}
                    <tr className="bg-muted/20 font-semibold border-t-2">
                        <Td>연간</Td>
                        <Td>-</Td>
                        <Td>-</Td>
                        <Td>-</Td>
                        <Td className="text-orange-600">
                            {fmt(data.filter(m => (m.theta_HK_av ?? 0) > 0).length > 0
                                ? data.reduce((s, m) => s + (m.theta_HK_av ?? 0), 0) / data.filter(m => (m.theta_HK_av ?? 0) > 0).length
                                : 0)}
                        </Td>
                        <Td>{fmt(sumField(m => m.t_h_rL ?? 0), 0)}</Td>
                    </tr>
                </DataTable>
            </Section>

            {/* ── 섹션 2: 방열 손실 ── */}
            <Section
                title={<>2. 방열 손실 <span className="text-muted-foreground font-normal">(DIN/TS 18599-5 §6.1~6.2)</span></>}
                icon={<Flame className="h-4 w-4 text-white" />}
                iconColor="bg-red-500"
            >
                <div className="space-y-6">
                    <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">2.1</span>
                            방열 시스템 보정 계수 (시스템 설정값)
                        </h4>
                        <DataTable headers={[
                            <K key="dstr" math="\Delta\theta_{str}" unit="(K)" tip="공기 층화 편차" />,
                            <K key="dctr" math="\Delta\theta_{ctr}" unit="(K)" tip="제어 편차" />,
                            <K key="demb" math="\Delta\theta_{emb}" unit="(K)" tip="매립 손실 편차" />,
                            <K key="drad" math="\Delta\theta_{rad}" unit="(K)" tip="복사열 편차" />,
                            <K key="dim" math="\Delta\theta_{im}" unit="(K)" tip="간헐 운전 편차" />,
                            <K key="dhydr" math="\Delta\theta_{hydr}" unit="(K)" tip="수력 불균형 편차" />,
                            <K key="daut" math="\Delta\theta_{aut}" unit="(K)" tip="실내 자동화 보정" />,
                            <K key="fhydr" math="f_{hydr}" unit="(-)" tip="수력 평형 계수" />,
                        ]}>
                            {data.length > 0 && (
                                // 시스템 설정값은 난방 기간(Q_h_b > 0)인 첫 번째 데이터를 기준으로 표시
                                (() => {
                                    const m = data.find(item => item.Q_h_b > 0) || data[0];
                                    const labels = (m as any).emissionLabels;
                                    return (
                                        <>
                                            <tr className="bg-muted/5">
                                                <Td>{fmt(m.delta_theta_str, 2)}</Td>
                                                <Td className="font-semibold text-orange-600">{fmt(m.delta_theta_ctr, 2)}</Td>
                                                <Td>{fmt(m.delta_theta_emb, 2)}</Td>
                                                <Td>{fmt(m.delta_theta_rad, 2)}</Td>
                                                <Td>{fmt(m.delta_theta_im, 2)}</Td>
                                                <Td className="font-semibold text-blue-600">{fmt(m.delta_theta_hydr, 2)}</Td>
                                                <Td className="font-semibold text-emerald-600">{fmt(m.delta_theta_roomaut, 2)}</Td>
                                                <Td className="font-bold">{fmt(m.f_hydr, 2)}</Td>
                                            </tr>
                                            {labels && (
                                                <tr className="bg-muted/10 border-t-0">
                                                    <Td wrap className="text-[10px] text-muted-foreground pt-0 pb-2 leading-tight align-top max-w-[120px]">
                                                        {labels.stratification || "-"}
                                                    </Td>
                                                    <Td wrap className="text-[10px] text-orange-500/80 pt-0 pb-2 leading-tight align-top font-medium max-w-[120px]">
                                                        {labels.control || "-"}
                                                    </Td>
                                                    <Td wrap className="text-[10px] text-muted-foreground pt-0 pb-2 leading-tight align-top max-w-[120px]">
                                                        {labels.embedding || "-"}
                                                    </Td>
                                                    <Td wrap className="text-[10px] text-muted-foreground pt-0 pb-2 leading-tight align-top max-w-[120px]">-</Td>
                                                    <Td wrap className="text-[10px] text-muted-foreground pt-0 pb-2 leading-tight align-top max-w-[120px]">-</Td>
                                                    <Td wrap className="text-[10px] text-blue-500/80 pt-0 pb-2 leading-tight align-top font-medium max-w-[120px]">
                                                        {labels.hydraulic || "-"}
                                                    </Td>
                                                    <Td wrap className="text-[10px] text-emerald-500/80 pt-0 pb-2 leading-tight align-top font-medium max-w-[120px]">
                                                        {labels.automation || "-"}
                                                    </Td>
                                                    <Td wrap className="text-[10px] text-muted-foreground pt-0 pb-2 leading-tight align-top max-w-[120px]">-</Td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })()
                            )}
                        </DataTable>
                            {data.length > 0 && (
                                (() => {
                                    const m = data.find(item => item.Q_h_b > 0) || data[0];
                                    const loadDetails = (m as any).heatingLoadDetails;
                                    if (!loadDetails) return null;

                                    return (
                                        <div className="mt-6 mb-2">
                                            <h5 className="text-xs font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
                                                <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">상세</span>
                                                존 최대 난방 부하 산출 제원
                                            </h5>
                                            <div className="bg-muted/10 p-2 rounded-md border text-sm">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="text-xs text-muted-foreground border-b border-muted/50">
                                                            <th className="font-medium pb-1.5 pt-1 px-3">설계 외기온도 (<K math="\theta_{e,min}" />)</th>
                                                            <th className="font-medium pb-1.5 pt-1 px-3">관류손실 계수 (<K math="H_{tr,sys}" />)</th>
                                                            <th className="font-medium pb-1.5 pt-1 px-3">환기손실 계수 (<K math="H_{ve,sys}" />)</th>
                                                            <th className="font-medium pb-1.5 pt-1 px-3">설정 난방온도 (<K math="\theta_{int,H}" />)</th>
                                                            <th className="font-medium pb-1.5 pt-1 px-3 border-l border-muted/50">면적 (<K math="A_{NGF}" />)</th>
                                                            <th className="font-medium pb-1.5 pt-1 px-3">최대 난방부하 (<K math="P_{h,max}" />)</th>
                                                            <th className="font-medium pb-1.5 pt-1 px-3">단위면적당 부하 (<K math="p_h" />)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td className="py-1.5 px-3">{fmt(loadDetails.Te_min, 1)} °C</td>
                                                            <td className="py-1.5 px-3">{fmt(loadDetails.H_tr, 1)} W/K</td>
                                                            <td className="py-1.5 px-3">{fmt(loadDetails.H_ve, 1)} W/K</td>
                                                            <td className="py-1.5 px-3">{fmt(loadDetails.Theta_int_H, 1)} °C</td>
                                                            <td className="py-1.5 px-3 border-l border-muted/50">{fmt(loadDetails.A_NGF, 1)} m²</td>
                                                            <td className="py-1.5 px-3">{fmt(loadDetails.P_h_max, 1)} W</td>
                                                            <td className="py-1.5 px-3 text-red-600 font-medium">{fmt(loadDetails.p_h, 1)} W/m²</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()
                            )}
                            {data.length > 0 && (
                                (() => {
                                    const m = data.find(item => item.Q_h_b > 0) || data[0];
                                    const details = (m as any).emissionHallDetails;
                                    if (!details) return null;

                                    return (
                                        <div className="mt-6">
                                            <h5 className="text-xs font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
                                                <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">상세</span>
                                                대공간 난방 보정 변수 상세
                                            </h5>
                                            <div className="bg-muted/10 p-2 rounded-md border text-sm">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="text-xs text-muted-foreground border-b border-muted/50">
                                                            <th className="font-medium pb-1.5 pt-1 px-3">온도 구배 (<K math="\theta'_{str}" />)</th>
                                                            <th className="font-medium pb-1.5 pt-1 px-3">적용 천장고 (<K math="h_R" />)</th>
                                                            <th className="font-medium pb-1.5 pt-1 px-3">난방 부하 (<K math="p_h" />)</th>
                                                            <th className="font-medium pb-1.5 pt-1 px-3">복사 계수 (<K math="RF" />)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td className="py-1.5 px-3">{fmt(details.theta_str_prime, 2)} K/m</td>
                                                            <td className="py-1.5 px-3">{fmt(details.h_R, 1)} m</td>
                                                            <td className="py-1.5 px-3">{fmt(details.p_h, 1)} W/m²</td>
                                                            <td className="py-1.5 px-3">{fmt(details.RF, 2)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()
                            )}

                    </div>

                    <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">2.2</span>
                            월별 방열 손실 계산 내역
                        </h4>
                        <DataTable headers={[
                            "월",
                            <K key="qhb" math="Q_{h,b}" unit="(kWh)" tip="난방 부하 — 건물에 필요한 난방 에너지 요구량"
                               formula="Q_{h,b} = Q_{sink} - \eta_h \cdot Q_{source}" />,
                            <K key="ti" math="\theta_i" unit="(°C)" tip="내부 설정 온도" />,
                            <K key="te" math="\theta_e" unit="(°C)" tip="외부 온도" />,
                            <K key="dt" math="\Delta\theta_{ce}" unit="(K)" tip="방열 온도 편차 총합"
                               formula="\Delta\theta_{ce} = \sum \Delta\theta_{x}" />,
                            <K key="qce" math="Q_{h,ce}" unit="(kWh)" tip="방열 손실 — 실내 온도 편차로 인한 추가 에너지 소비"
                               formula="Q_{h,ce} = Q_{h,b} \cdot \frac{\Delta\theta_{ce}}{\theta_i - \theta_e}" />,
                        ]}>
                            {data.map((m, i) => (
                                <tr key={m.month} className="hover:bg-muted/10">
                                    <Td className="font-medium">{MONTHS[i]}</Td>
                                    <Td>{fmt(m.Q_h_b)}</Td>
                                    <Td>{fmt(m.Theta_i_h_soll)}</Td>
                                    <Td>{fmt(m.Theta_e)}</Td>
                                    <Td className="font-semibold text-red-500 bg-red-50/50">{fmt(m.delta_theta_ce, 2)}</Td>
                                    <Td className="font-bold text-red-600 bg-red-50">{fmt(m.Q_h_ce)}</Td>
                                </tr>
                            ))}
                            <tr className="bg-muted/20 font-semibold border-t-2">
                                <Td>연간</Td>
                                <Td>{fmt(sumField(m => m.Q_h_b || 0))}</Td>
                                <Td>-</Td>
                                <Td>{fmt(data.length > 0 ? data.reduce((s, m) => s + (m.Theta_e || 0), 0) / data.length : 0)}</Td>
                                <Td>-</Td>
                                <Td className="text-red-600">{fmt(sumField(m => m.Q_h_ce || 0))}</Td>
                            </tr>
                        </DataTable>
                    </div>
                </div>
            </Section>

            {/* ── 섹션 3: 배관 분배 손실 ── */}
            <Section
                title={<>3. 배관 분배 손실 <span className="text-muted-foreground font-normal">(DIN/TS 18599-5 §6.3)</span></>}
                icon={<PipetteIcon className="h-4 w-4 text-white" />}
                iconColor="bg-blue-500"
            >
                <DataTable headers={[
                    "월",
                    <K key="op" math="Q_{h,d,op}" unit="(kWh)" tip="가동 시 배관 손실 — 난방 운전 중 배관에서 방출되는 열"
                       formula="Q_{h,d,op} = L \cdot U_l \cdot \Delta T \cdot t_{op} \cdot 10^{-3}" />,
                    <K key="nop" math="Q_{h,d,non}" unit="(kWh)" tip="비가동 시 배관 손실 — 운전 정지 중 잔류 열에 의한 배관 열 방출"
                       formula="Q_{h,d,non} = L \cdot U_l \cdot \Delta T_{non} \cdot t_{non} \cdot 10^{-3}" />,
                    <K key="tt" math="Q_{h,d}" unit="(kWh)" tip="총 배관 분배 손실 — 가동 + 비가동 합산"
                       formula="Q_{h,d} = Q_{h,d,op} + Q_{h,d,non}" />,
                    <K key="dtt" math="\Delta T" unit="(K)" tip="온도차 — 배관 내부와 주변 사이의 온도 차이"
                       formula="\Delta T = \theta_{HK,av} - \theta_{amb}" />,
                    <K key="hrs" math="t" unit="(h)" tip="시간 — 해당 월의 총 시간" />,
                ]}>
                    {data.map((m, i) => {
                        const det = m.systemLosses?.heating?.details?.distribution;
                        const total = m.systemLosses?.heating?.distribution ?? 0;
                        return (
                            <tr key={m.month} className="hover:bg-muted/10">
                                <Td className="font-medium">{MONTHS[i]}</Td>
                                <Td>{fmt(det?.op?.Q_loss)}</Td>
                                <Td>{fmt(det?.non_op?.Q_loss)}</Td>
                                <Td className="font-semibold text-blue-600">{fmt(total)}</Td>
                                <Td>{fmt(det?.total?.dT)}</Td>
                                <Td>{fmt(det?.total?.hours, 0)}</Td>
                            </tr>
                        );
                    })}
                    <tr className="bg-muted/20 font-semibold border-t-2">
                        <Td>연간</Td>
                        <Td>{fmt(sumField(m => m.systemLosses?.heating?.details?.distribution?.op?.Q_loss ?? 0))}</Td>
                        <Td>{fmt(sumField(m => m.systemLosses?.heating?.details?.distribution?.non_op?.Q_loss ?? 0))}</Td>
                        <Td className="text-blue-600">{fmt(sumField(m => m.systemLosses?.heating?.distribution ?? 0))}</Td>
                        <Td>-</Td>
                        <Td>-</Td>
                    </tr>
                </DataTable>
            </Section>

            {/* ── 섹션 4: 저장 손실 ── */}
            <Section
                title={<>4. 저장 손실 <span className="text-muted-foreground font-normal">(DIN/TS 18599-5 §6.4)</span></>}
                icon={<Database className="h-4 w-4 text-white" />}
                iconColor="bg-indigo-500"
            >
                <DataTable headers={[
                    "월",
                    <K key="op" math="Q_{h,s,op}" unit="(kWh)" tip="가동 시 저장 손실 — 난방 운전 중 버퍼 탱크에서 방출되는 대기 열"
                       formula="Q_{h,s,op} = U_s \cdot A_s \cdot \Delta T \cdot t_{op} \cdot 10^{-3}" />,
                    <K key="nop" math="Q_{h,s,non}" unit="(kWh)" tip="비가동 시 저장 손실 — 운전 정지 중 탱크 표면을 통한 열 방출"
                       formula="Q_{h,s,non} = U_s \cdot A_s \cdot \Delta T_{non} \cdot t_{non} \cdot 10^{-3}" />,
                    <K key="tt" math="Q_{h,s}" unit="(kWh)" tip="총 저장 손실 — 버퍼 탱크에서 발생하는 월간 합산 열 손실"
                       formula="Q_{h,s} = Q_{h,s,op} + Q_{h,s,non}" />,
                    <K key="dt" math="\Delta T" unit="(K)" tip="온도차 — 저장 탱크와 주변 공기 사이의 온도 차이"
                       formula="\Delta T = \theta_{s,av} - \theta_{amb}" />,
                    <K key="hrs" math="t" unit="(h)" tip="시간 — 해당 월의 총 시간" />,
                ]}>
                    {data.map((m, i) => {
                        const det = m.systemLosses?.heating?.details?.storage;
                        const total = m.systemLosses?.heating?.storage ?? 0;
                        return (
                            <tr key={m.month} className="hover:bg-muted/10">
                                <Td className="font-medium">{MONTHS[i]}</Td>
                                <Td>{fmt(det?.op?.Q_loss)}</Td>
                                <Td>{fmt(det?.non_op?.Q_loss)}</Td>
                                <Td className="font-semibold text-indigo-600">{fmt(total)}</Td>
                                <Td>{fmt(det?.total?.dT)}</Td>
                                <Td>{fmt(det?.total?.hours, 0)}</Td>
                            </tr>
                        );
                    })}
                    <tr className="bg-muted/20 font-semibold border-t-2">
                        <Td>연간</Td>
                        <Td>{fmt(sumField(m => m.systemLosses?.heating?.details?.storage?.op?.Q_loss ?? 0))}</Td>
                        <Td>{fmt(sumField(m => m.systemLosses?.heating?.details?.storage?.non_op?.Q_loss ?? 0))}</Td>
                        <Td className="text-indigo-600">{fmt(sumField(m => m.systemLosses?.heating?.storage ?? 0))}</Td>
                        <Td>-</Td>
                        <Td>-</Td>
                    </tr>
                </DataTable>
            </Section>

            {/* ── 섹션 5: 발전 손실 ── */}
            <Section
                title={<>5. 발전 손실 <span className="text-muted-foreground font-normal">(DIN/TS 18599-5 §6.5)</span></>}
                icon={<Flame className="h-4 w-4 text-white" />}
                iconColor="bg-amber-600"
            >
                <DataTable headers={[
                    "월",
                    <K key="op" math="Q_{h,g,op}" unit="(kWh)" tip="가동 시 발전 손실 — 보일러 가동 중 연소 효율 차이로 발생"
                       formula="Q_{h,g,op} = Q_{outg} \cdot \left(\frac{1}{\eta_{g,op}} - 1\right)" />,
                    <K key="nop" math="Q_{h,g,non}" unit="(kWh)" tip="비가동 시 발전 손실 — 보일러 대기 모드에서의 방열 손실"
                       formula="Q_{h,g,non} = q_{P,0} \cdot \Phi_{max} \cdot t_{non} \cdot 10^{-3}" />,
                    <K key="tt" math="Q_{h,g}" unit="(kWh)" tip="총 발전 손실 — 보일러 가동·대기 중 발생하는 월간 합산 열 손실"
                       formula="Q_{h,g} = Q_{h,g,op} + Q_{h,g,non}" />,
                    <K key="out" math="Q_{outg}" unit="(kWh)" tip="보일러 출력 — 난방 요구 + 시스템 손실을 합산한 열원 요구량"
                       formula="Q_{outg} = Q_{h,need+ce} + Q_{h,d} + Q_{h,s}" />,
                ]}>
                    {data.map((m, i) => {
                        const det = m.systemLosses?.heating?.details?.generation;
                        const total = m.systemLosses?.heating?.generation ?? 0;
                        return (
                            <tr key={m.month} className="hover:bg-muted/10">
                                <Td className="font-medium">{MONTHS[i]}</Td>
                                <Td>{fmt(det?.op?.Q_loss)}</Td>
                                <Td>{fmt(det?.non_op?.Q_loss)}</Td>
                                <Td className="font-semibold text-amber-600">{fmt(total)}</Td>
                                <Td>{fmt(det?.total?.Q_loss)}</Td>
                            </tr>
                        );
                    })}
                    <tr className="bg-muted/20 font-semibold border-t-2">
                        <Td>연간</Td>
                        <Td>{fmt(sumField(m => m.systemLosses?.heating?.details?.generation?.op?.Q_loss ?? 0))}</Td>
                        <Td>{fmt(sumField(m => m.systemLosses?.heating?.details?.generation?.non_op?.Q_loss ?? 0))}</Td>
                        <Td className="text-amber-600">{fmt(sumField(m => m.systemLosses?.heating?.generation ?? 0))}</Td>
                        <Td>-</Td>
                    </tr>
                </DataTable>
            </Section>

            {/* ── 섹션 6: 급탕 배관/저장 손실 ── */}
            <Section
                title={<>6. 급탕 배관/저장 손실 <span className="text-muted-foreground font-normal">(DIN/TS 18599-8)</span></>}
                icon={<Droplets className="h-4 w-4 text-white" />}
                iconColor="bg-cyan-500"
            >
                <DataTable headers={[
                    "월",
                    <K key="qwb" math="Q_{w,b}" unit="(kWh)" tip="급탕 부하 — 급탕 온수에 필요한 열 에너지"
                       formula="Q_{w,b} = q_{w,b,day} \cdot A_{NGF} \cdot d" />,
                    <K key="qwd" math="Q_{w,d}" unit="(kWh)" tip="급탕 배관 손실 — 순환 배관을 통해 방출되는 열"
                       formula="Q_{w,d} = L_{w,d} \cdot U_l \cdot \Delta T \cdot t_{circ} \cdot d \cdot 10^{-3}" />,
                    <K key="qws" math="Q_{w,s}" unit="(kWh)" tip="급탕 저장 손실 — 온수 저장 탱크에서 방출되는 대기 열 (식 30)"
                       formula="Q_{w,s} = q_{w,s,day} \cdot d = (5.09 \cdot V_s^{0.55}) \cdot \frac{\Delta T}{45} \cdot d" />,
                    <K key="lwd" math="L_{w,d}" unit="(m)" tip="급탕 배관 길이 — 순환 배관의 추정 길이 (표 12)"
                       formula="L_{w,d} = f(A_{NGF}, \text{건물유형})" />,
                    <K key="ul" math="U_l" unit="(W/mK)" tip="선열손실계수 — 단열 수준에 따른 배관 열손실 계수 (표 10)"
                       formula="U_l = f(\text{단열등급})" />,
                    <K key="dt" math="\Delta T" unit="(K)" tip="온도차 — 급탕 배관 내 온수와 주변 공기의 온도 차이"
                       formula="\Delta T = \theta_{w,av} - \theta_i" />,
                    <K key="vs" math="V_s" unit="(L)" tip="저장 탱크 체적 — 급탕 온수 저장 탱크의 용량 (표 54)"
                       formula="V_s = f(A_{NGF})" />,
                ]}>
                    {data.map((m, i) => {
                        const meta = (m.internalGains as any)?.metadata;
                        return (
                            <tr key={m.month} className="hover:bg-muted/10">
                                <Td className="font-medium">{MONTHS[i]}</Td>
                                <Td>{fmt(meta?.Q_w_b_day != null ? meta.Q_w_b_day * (m as any).Area : (m.Q_w_b || 0))}</Td>
                                <Td className="text-cyan-600 font-semibold">{fmt(meta?.Q_w_d)}</Td>
                                <Td className="text-cyan-600 font-semibold">{fmt(meta?.Q_w_s)}</Td>
                                <Td>{fmt(meta?.L_w_d)}</Td>
                                <Td>{fmt(meta?.U_l_w_d, 3)}</Td>
                                <Td>{fmt(meta?.dT_pipe)}</Td>
                                <Td>{fmt(meta?.V_storage, 0)}</Td>
                            </tr>
                        );
                    })}
                    <tr className="bg-muted/20 font-semibold border-t-2">
                        <Td>연간</Td>
                        <Td>{fmt(sumField(m => m.Q_w_b || 0))}</Td>
                        <Td className="text-cyan-600">{fmt(sumField(m => (m.internalGains as any)?.metadata?.Q_w_d ?? 0))}</Td>
                        <Td className="text-cyan-600">{fmt(sumField(m => (m.internalGains as any)?.metadata?.Q_w_s ?? 0))}</Td>
                        <Td>-</Td>
                        <Td>-</Td>
                        <Td>-</Td>
                        <Td>-</Td>
                    </tr>
                </DataTable>
            </Section>

            {/* ── 섹션 7: 에너지 흐름 요약 ── */}
            <Section
                title={<>7. 에너지 흐름 요약 <span className="text-muted-foreground font-normal">(최종 → 1차 에너지)</span></>}
                icon={<BarChart3 className="h-4 w-4 text-white" />}
                iconColor="bg-emerald-600"
                defaultOpen={true}
            >
                <DataTable headers={[
                    "월",
                    <K key="hfe" math="Q_{h,f}" unit="(kWh)" tip="난방 최종 에너지 — 보일러에 투입되는 연료 에너지"
                       formula="Q_{h,f} = Q_{outg} + Q_{h,g}" />,
                    <K key="cfe" math="Q_{c,f}" unit="(kWh)" tip="냉방 최종 에너지 — 냉동기에 투입되는 전기 에너지"
                       formula="Q_{c,f} = Q_{c,b} + Q_{c,d} + Q_{c,s} + Q_{c,g}" />,
                    <K key="wfe" math="Q_{w,f}" unit="(kWh)" tip="급탕 최종 에너지 — 급탕 열원에 투입되는 연료 에너지"
                       formula="Q_{w,f} = Q_{w,b} + Q_{w,d} + Q_{w,s}" />,
                    <K key="lfe" math="Q_{l,f}" unit="(kWh)" tip="조명 최종 에너지 — 조명 시스템에 소비되는 전기 에너지"
                       formula="Q_{l,f} = P_{inst} \cdot A \cdot t_{eff} \cdot 10^{-3}" />,
                    <K key="afe" math="Q_{aux,f}" unit="(kWh)" tip="보조 최종 에너지 — 펌프·팬 등 보조 기기의 전기 에너지" />,
                    <K key="hpe" math="Q_{h,p}" unit="(kWh)" tip="난방 1차 에너지 — 1차 에너지 변환 계수 적용"
                       formula="Q_{h,p} = Q_{h,f} \cdot f_p" />,
                    <K key="wpe" math="Q_{w,p}" unit="(kWh)" tip="급탕 1차 에너지 — 1차 에너지 변환 계수 적용"
                       formula="Q_{w,p} = Q_{w,f} \cdot f_p" />,
                    <K key="tpe" math="Q_{p,total}" unit="(kWh)" tip="총 1차 에너지 — 모든 용도의 1차 에너지 합산"
                       formula="Q_{p,total} = \sum_i Q_{i,f} \cdot f_{p,i}" />,
                ]}>
                    {data.map((m, i) => (
                        <tr key={m.month} className="hover:bg-muted/10">
                            <Td className="font-medium">{MONTHS[i]}</Td>
                            <Td className="text-red-600">{fmt(m.finalEnergy?.heating)}</Td>
                            <Td className="text-blue-600">{fmt(m.finalEnergy?.cooling)}</Td>
                            <Td className="text-cyan-600">{fmt(m.finalEnergy?.dhw)}</Td>
                            <Td>{fmt(m.finalEnergy?.lighting)}</Td>
                            <Td>{fmt(m.finalEnergy?.auxiliary)}</Td>
                            <Td className="text-red-600">{fmt(m.primaryEnergy?.heating)}</Td>
                            <Td className="text-cyan-600">{fmt(m.primaryEnergy?.dhw)}</Td>
                            <Td className="font-bold text-emerald-700">{fmt(m.primaryEnergy?.total)}</Td>
                        </tr>
                    ))}
                    <tr className="bg-muted/20 font-semibold border-t-2">
                        <Td>연간</Td>
                        <Td className="text-red-600">{fmt(sumField(m => m.finalEnergy?.heating ?? 0))}</Td>
                        <Td className="text-blue-600">{fmt(sumField(m => m.finalEnergy?.cooling ?? 0))}</Td>
                        <Td className="text-cyan-600">{fmt(sumField(m => m.finalEnergy?.dhw ?? 0))}</Td>
                        <Td>{fmt(sumField(m => m.finalEnergy?.lighting ?? 0))}</Td>
                        <Td>{fmt(sumField(m => m.finalEnergy?.auxiliary ?? 0))}</Td>
                        <Td className="text-red-600">{fmt(sumField(m => m.primaryEnergy?.heating ?? 0))}</Td>
                        <Td className="text-cyan-600">{fmt(sumField(m => m.primaryEnergy?.dhw ?? 0))}</Td>
                        <Td className="font-bold text-emerald-700">{fmt(sumField(m => m.primaryEnergy?.total ?? 0))}</Td>
                    </tr>
                </DataTable>
            </Section>

            {/* ── 난방 에너지 흐름 Sankey 요약 ── */}
            <Card className="bg-muted/10 border-dashed">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">난방 에너지 흐름 요약 (연간)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center text-xs">
                        <FlowCard label="난방 부하" math="Q_{h,b}" value={sumField(m => m.Q_h_b || 0)} color="text-red-700"
                            tip="건물에 필요한 난방 에너지 요구량" formula="Q_{h,b} = Q_{sink} - \eta_h \cdot Q_{source}" />
                        <FlowCard label="+ 방열 손실" math="Q_{h,ce}" value={sumField(m => m.Q_h_ce || 0)} color="text-red-500"
                            tip="방열기 제어·수력 불균형으로 인한 추가 손실" formula="Q_{h,ce} = Q_{h,b} \cdot \frac{\Delta\theta_{ce}}{\theta_i - \theta_e} \cdot f_{hydr}" />
                        <FlowCard label="+ 배관 손실" math="Q_{h,d}" value={sumField(m => m.systemLosses?.heating?.distribution ?? 0)} color="text-blue-600"
                            tip="난방 배관에서 방출되는 분배 열 손실" formula="Q_{h,d} = L \cdot U_l \cdot \Delta T \cdot t \cdot 10^{-3}" />
                        <FlowCard label="+ 저장 손실" math="Q_{h,s}" value={sumField(m => m.systemLosses?.heating?.storage ?? 0)} color="text-indigo-600"
                            tip="버퍼 탱크 표면에서 방출되는 대기 열 손실" formula="Q_{h,s} = U_s \cdot A_s \cdot \Delta T \cdot t \cdot 10^{-3}" />
                        <FlowCard label="→ 최종 에너지" math="Q_{h,f}" value={sumField(m => m.finalEnergy?.heating ?? 0)} color="text-emerald-700" bold
                            tip="보일러에 투입되는 최종 연료 에너지" formula="Q_{h,f} = Q_{outg} + Q_{h,g}" />
                    </div>
                </CardContent>
            </Card>
        </div>
        </TooltipProvider>
    );
}

/** 에너지 흐름 카드 — KaTeX 수식 + 툴팁 + 계산식 */
function FlowCard({ label, math, value, color, bold, tip, formula }: {
    label: string; math: string; value: number; color: string; bold?: boolean; tip?: string; formula?: string;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={`p-3 rounded-md bg-background border cursor-help ${bold ? "border-2 border-emerald-300" : ""}`}>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
                    <div className="text-muted-foreground text-[11px] mb-1">
                        <InlineMath math={math} />
                    </div>
                    <div className={`text-lg ${bold ? "font-bold" : "font-semibold"} ${color}`}>
                        {value.toFixed(0)}
                        <span className="text-[10px] text-muted-foreground ml-0.5">kWh</span>
                    </div>
                </div>
            </TooltipTrigger>
            {tip && (
                <TooltipContent side="top" className="max-w-[420px] text-xs p-3">
                    <p className="font-bold mb-1"><InlineMath math={math} /></p>
                    <p className="text-muted-foreground mb-1.5">{tip}</p>
                    {formula && (
                        <div className="border-t pt-1.5 mt-1 overflow-x-auto">
                            <BlockMath math={formula} />
                        </div>
                    )}
                </TooltipContent>
            )}
        </Tooltip>
    );
}
