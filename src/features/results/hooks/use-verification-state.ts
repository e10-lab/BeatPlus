import { useState, useCallback, useMemo } from "react";
import { MonthlyResult } from "@/engine/types";

interface VerificationStateOptions {
    initialExpanded?: Record<string, boolean>;
    externalMonth?: number;
    externalIterationStep?: number | null;
}

/**
 * 검증 페이지의 상태(월, 반복 단계, 섹션 확장/축소)를 관리하는 커스텀 훅입니다.
 */
export function useVerificationState(
    data: MonthlyResult[],
    options: VerificationStateOptions = {}
) {
    const {
        initialExpanded = { step1: true, step2: false, step3: false, step4: false, step5: false, step6: false },
        externalMonth,
        externalIterationStep
    } = options;

    // 1. 섹션 확장/축소 상태
    const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(initialExpanded);

    // 2. 월 및 반복 단계 상태 (외부 상태가 있으면 그것을 우선시하고, 없으면 내부 상태 사용)
    const [internalMonth, setInternalMonth] = useState<number>(data[0]?.month || 1);
    const [internalIterationStep, setInternalIterationStep] = useState<number | null>(null);

    const selectedMonth = externalMonth !== undefined ? externalMonth : internalMonth;
    const selectedIterationStep = externalIterationStep !== undefined ? externalIterationStep : internalIterationStep;

    const toggleStep = useCallback((stepId: string) => {
        setExpandedSteps((prev) => ({
            ...prev,
            [stepId]: !prev[stepId],
        }));
    }, []);

    const toggleAll = useCallback((expanded: boolean) => {
        setExpandedSteps((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((key) => {
                next[key] = expanded;
            });
            return next;
        });
    }, []);

    const handleMonthChange = useCallback((month: number) => {
        setInternalMonth(month);
        setInternalIterationStep(null);
    }, []);

    const handleIterationSelect = useCallback((step: number | null) => {
        setInternalIterationStep(step);
    }, []);

    const currentMonthDataRaw = useMemo(() =>
        data.find((m) => m.month === selectedMonth) || data[0]
        , [data, selectedMonth]);

    // 반복 단계 세부 데이터 룩업 로직
    const getIterationData = useCallback((raw: MonthlyResult, step: number | null) => {
        if (!raw || step === null) return raw;

        const selectedLog = raw.iterationLogs?.find(L => L.step === step);
        if (!selectedLog?.details) return raw;

        return {
            ...raw,
            QT_heat: selectedLog.details.QT,
            QV_heat: selectedLog.details.QV,
            QS: selectedLog.details.QS,
            QI: selectedLog.details.QI,
            Q_h_b: selectedLog.details.Q_h_b,
            Q_c_b: selectedLog.details.Q_c_b,
            eta: selectedLog.details.eta_h,
            eta_C: selectedLog.details.eta_c,
            gamma: selectedLog.details.gamma_h,
            gamma_C: selectedLog.details.gamma_c,
        };
    }, []);

    const currentMonthData = useMemo(() =>
        getIterationData(currentMonthDataRaw, selectedIterationStep)
        , [currentMonthDataRaw, selectedIterationStep, getIterationData]);

    return {
        // Expanded state
        expandedSteps,
        setExpandedSteps,
        toggleStep,
        toggleAll,
        // Selection state
        selectedMonth,
        selectedIterationStep,
        currentMonthDataRaw,
        currentMonthData,
        handleMonthChange,
        handleIterationSelect,
    };
}
