import { Zone, Surface } from "@/types/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, AlertTriangle, CheckCircle2, Calculator, Ruler } from "lucide-react";

interface GeometricAnalysisProps {
    zone: Zone;
    surfaces: Surface[];
}

export function GeometricAnalysis({ zone, surfaces }: GeometricAnalysisProps) {
    // 1. Calculate Envelope Areas by Type
    const areaByType = surfaces.reduce((acc, surface) => {
        const type = surface.type;
        acc[type] = (acc[type] || 0) + surface.area;
        return acc;
    }, {} as Record<string, number>);

    const totalEnvelopeArea = Object.values(areaByType).reduce((a, b) => a + b, 0);

    // Grouping for clearer analysis
    const wallArea = (areaByType["wall_exterior"] || 0) + (areaByType["wall_ground"] || 0);
    const roofArea = (areaByType["roof_exterior"] || 0) + (areaByType["roof_ground"] || 0);
    const floorArea = (areaByType["floor_ground"] || 0) + (areaByType["floor_exterior"] || 0);
    const windowArea = areaByType["window"] || 0;
    const doorArea = areaByType["door"] || 0;

    // 2. Ratios
    // Window-to-Wall Ratio (WWR): Window Area / (Gross Wall Area)
    // Gross Wall Area usually includes Windows and Doors if they are embedded.
    // Assuming 'wall_exterior' is NET area (subtracted), we need Gross.
    // But typically in energy inputs, users input net areas or gross. 
    // If we assume users input NET wall area, then Gross Wall = Net Wall + Window + Door.
    // Let's assume surfaces are separate entities filling the implementation.
    const grossWallArea = wallArea + windowArea + doorArea;
    const wwr = grossWallArea > 0 ? (windowArea / grossWallArea) * 100 : 0;

    // Compactness Ratio (A/V)
    // Envelope Area / Volume
    const avRatio = zone.volume > 0 ? totalEnvelopeArea / zone.volume : 0;

    // 3. Validations
    const floorAreaCheck = Math.abs(floorArea - zone.area) / zone.area; // Deviation
    const showFloorWarning = floorArea > 0 && floorAreaCheck > 0.1; // > 10% deviation

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-primary" />
                        기하학적 분석 (Geometric Analysis)
                    </CardTitle>
                    <Badge variant="secondary" className="font-mono">
                        A/V Ratio: {avRatio.toFixed(2)}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Visual Distribution */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>외피 구성 비율 (Envelope Distribution)</span>
                        <span>총 면적: {totalEnvelopeArea.toFixed(2)} m²</span>
                    </div>
                    <div className="h-4 rounded-full w-full overflow-hidden flex">
                        {wallArea > 0 && <div style={{ width: `${(wallArea / totalEnvelopeArea) * 100}%` }} className="bg-blue-500 h-full" title={`벽체: ${wallArea.toFixed(1)}m²`} />}
                        {roofArea > 0 && <div style={{ width: `${(roofArea / totalEnvelopeArea) * 100}%` }} className="bg-amber-500 h-full" title={`지붕: ${roofArea.toFixed(1)}m²`} />}
                        {floorArea > 0 && <div style={{ width: `${(floorArea / totalEnvelopeArea) * 100}%` }} className="bg-emerald-500 h-full" title={`바닥: ${floorArea.toFixed(1)}m²`} />}
                        {windowArea > 0 && <div style={{ width: `${(windowArea / totalEnvelopeArea) * 100}%` }} className="bg-sky-300 h-full" title={`창호: ${windowArea.toFixed(1)}m²`} />}
                        {doorArea > 0 && <div style={{ width: `${(doorArea / totalEnvelopeArea) * 100}%` }} className="bg-stone-400 h-full" title={`문: ${doorArea.toFixed(1)}m²`} />}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                        {wallArea > 0 && <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" />벽체 ({((wallArea / totalEnvelopeArea) * 100).toFixed(0)}%)</div>}
                        {roofArea > 0 && <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" />지붕 ({((roofArea / totalEnvelopeArea) * 100).toFixed(0)}%)</div>}
                        {floorArea > 0 && <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" />바닥 ({((floorArea / totalEnvelopeArea) * 100).toFixed(0)}%)</div>}
                        {windowArea > 0 && <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-sky-300" />창호 ({((windowArea / totalEnvelopeArea) * 100).toFixed(0)}%)</div>}
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-muted/20 rounded-lg border">
                        <div className="text-xs text-muted-foreground mb-1">창면적비 (WWR)</div>
                        <div className="text-2xl font-bold">{wwr.toFixed(1)}%</div>
                        <Progress value={wwr} max={100} className="h-1.5 mt-2 bg-muted" indicatorClassName={wwr > 40 ? "bg-red-400" : "bg-primary"} />
                    </div>
                    <div className="p-3 bg-muted/20 rounded-lg border">
                        <div className="text-xs text-muted-foreground mb-1">총 외피면적</div>
                        <div className="text-2xl font-bold">{totalEnvelopeArea.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">m²</span></div>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-lg border">
                        <div className="text-xs text-muted-foreground mb-1">존 바닥면적</div>
                        <div className="text-2xl font-bold">{zone.area.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">m²</span></div>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-lg border">
                        <div className="text-xs text-muted-foreground mb-1">체적</div>
                        <div className="text-2xl font-bold">{zone.volume.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">m³</span></div>
                    </div>
                </div>

                {/* Warnings / Insights */}
                {showFloorWarning && (
                    <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle>바닥 면적 불일치 (Area Mismatch)</AlertTitle>
                        <AlertDescription className="text-amber-800">
                            입력된 바닥 외피 면적 합계({floorArea.toFixed(1)}m²)가 존 설정 면적({zone.area.toFixed(1)}m²)과 10% 이상 차이나납니다. 누락된 바닥이나 중복 입력이 없는지 확인하세요.
                        </AlertDescription>
                    </Alert>
                )}
                {!showFloorWarning && floorArea > 0 && (
                    <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <AlertDescription className="text-emerald-800">
                            바닥 외피 면적이 존 설정 면적과 대체로 일치합니다.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
