"use client";

import { useEffect } from "react";
import { useProjectCalculation } from "../hooks/use-project-calculation";
import { useCalculation } from "@/providers/calculation-provider";

interface ProjectBackgroundCalculatorProps {
    projectId: string;
}

/**
 * 화면에 렌더링되지 않지만 프로젝트 상세 페이지가 열릴 때 
 * 백그라운드에서 엔진 계산을 자동으로 수행하는 헤드리스 컴포넌트입니다.
 */
export function ProjectBackgroundCalculator({ projectId }: ProjectBackgroundCalculatorProps) {
    const { runCalculation } = useProjectCalculation();
    const { refreshTrigger } = useCalculation();

    useEffect(() => {
        if (projectId) {
            console.log(`[ProjectBackgroundCalculator] Triggering calculation for project: ${projectId} (Trigger: ${refreshTrigger})`);
            runCalculation(projectId);
        }
    }, [projectId, runCalculation, refreshTrigger]);

    return null; // Headless component
}
