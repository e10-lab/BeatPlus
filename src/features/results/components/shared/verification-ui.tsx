import React from "react";
import { Latex } from "@/components/ui/latex";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KaTeX 수식과 툴팁 설명을 결합한 컴포넌트
 */
export function MathTooltip({ 
  math, 
  title, 
  children, 
  className 
}: { 
  math: string; 
  title?: string; 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-help decoration-dotted underline underline-offset-2", className)}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs p-2 text-[11px]">
        {title && <p className="font-bold mb-1">{title} (<Latex formula={math} />)</p>}
        {!title && <Latex formula={math} />}
        <div className="mt-1 text-slate-400">
          <Latex formula={math} />
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * 'Step X' 배지가 포함된 표준 섹션 레이아웃
 */
interface VerificationSectionProps {
  step?: string;
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  rightElement?: React.ReactNode;
}

export function VerificationSection({ 
  step, 
  title, 
  description,
  children, 
  className,
  collapsible,
  isExpanded = true,
  onToggle,
  rightElement
}: VerificationSectionProps) {
  const HeaderTag = collapsible ? "button" : "div";
  
  return (
    <section className={cn("space-y-4", collapsible && "border rounded-xl overflow-hidden shadow-sm bg-white", className)}>
      <HeaderTag 
        onClick={collapsible ? onToggle : undefined}
        className={cn(
          "w-full flex items-center justify-between",
          !collapsible && "border-b pb-2",
          collapsible && "p-4 transition-colors text-left",
          collapsible && isExpanded ? "bg-slate-50/80 border-b" : collapsible && "hover:bg-slate-50"
        )}
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {step && (
            <span className={cn(
              "px-2 py-0.5 rounded font-mono text-sm",
              collapsible ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-700"
            )}>
              {step}
            </span>
          )}
          {typeof title === "string" && (title.startsWith("\\") || (title.includes("\\") && !title.includes(" "))) ? (
            <Latex formula={title} />
          ) : (
            title
          )}
        </h3>
        <div className="flex items-center gap-4">
          {rightElement}
          {collapsible && (
            isExpanded ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </HeaderTag>
      {(!collapsible || isExpanded) && (
        <div className={cn(collapsible && "p-4 animate-in fade-in slide-in-from-top-1 duration-200")}>
          {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * 일관된 스타일의 월 선택 드롭다운
 */
export function MonthSelector({ 
  months, 
  value, 
  onChange,
  className 
}: { 
  months: number[]; 
  value: number; 
  onChange: (month: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm font-medium">조회 월:</span>
      <Select value={value.toString()} onValueChange={(v) => onChange(parseInt(v))}>
        <SelectTrigger className="w-[90px] h-8 text-xs">
          <SelectValue placeholder="월 선택" />
        </SelectTrigger>
        <SelectContent>
          {months.map(m => (
            <SelectItem key={m} value={m.toString()}>{m}월</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
