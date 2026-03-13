"use client";

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexProps {
    formula: string;
    inline?: boolean;
    displayMode?: boolean; // react-katex와 호환을 위해 추가
    className?: string;
}

/**
 * KaTeX를 사용하여 수학 기호 및 수식을 렌더링하는 컴포넌트입니다.
 * @param formula KaTeX 수식 문자열 (예: "n_{50}", "f_{ATD}")
 * @param inline 인라인 모드 여부 (기본값: true)
 * @param className 추가 스타일 클래스
 */
export const Latex: React.FC<LatexProps> = ({ formula, inline = true, displayMode, className = "" }) => {
    const isDisplayMode = displayMode !== undefined ? displayMode : !inline;

    const html = useMemo(() => {
        try {
            return katex.renderToString(formula, {
                displayMode: isDisplayMode,
                throwOnError: false,
            });
        } catch (error) {
            console.error("KaTeX rendering error:", error);
            return formula;
        }
    }, [formula, isDisplayMode]);

    return (
        <span
            className={`${className} inline-flex items-baseline`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};
