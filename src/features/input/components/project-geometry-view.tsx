"use client";

import { LayoutList } from "lucide-react";
import { useState } from "react";
import { Zone } from "@/types/project";
import { ZoneList } from "./zone-list";
import { ZoneForm } from "./zone-form";
import { SurfaceList } from "./surface-list";
import { SurfaceForm } from "./surface-form";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Construction } from "@/types/project";
import { ConstructionManager } from "./construction-manager";
import { VentilationUnitManager } from "./ventilation-unit-manager";
import { getConstructions } from "@/services/construction-service";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateStandardN50 } from "@/lib/standard-values";
import { Latex } from "@/components/ui/latex";
import { Label } from "@/components/ui/label";
import { updateZone } from "@/services/zone-service";
import { getProjectStats, getProject, updateProjectVentilation } from "@/services/project-service";
import { ProjectStats } from "@/lib/standard-values";
import { Project } from "@/types/project";
import { Input } from "@/components/ui/input";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { BuildingSystem } from "@/types/system";
import { getZones } from "@/services/zone-service";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ProjectGeometryViewProps {
    projectId: string;
}

export function ProjectGeometryView({ projectId }: ProjectGeometryViewProps) {
    // ...
    const [viewMode, setViewMode] = useState<"list" | "form" | "zone-detail" | "surface-form">("list");
    const [selectedTab, setSelectedTab] = useState("zones");
    const [constructions, setConstructions] = useState<Construction[]>([]);
    const [projectStats, setProjectStats] = useState<ProjectStats>({ totalVolume: 0, totalEnvelopeArea: 0 });
    const [project, setProject] = useState<Project | null>(null);
    const [selectedZone, setSelectedZone] = useState<Zone | undefined>(undefined);
    const [selectedSurface, setSelectedSurface] = useState<any | undefined>(undefined);
    const [zones, setZones] = useState<Zone[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Load Constructions on Mount
    useEffect(() => {
        loadConstructions();
        loadProjectStats();
        loadZones();
    }, [projectId]);

    // Reload stats when refreshTrigger changes (e.g. after zone add/edit)
    useEffect(() => {
        loadProjectStats();
        loadZones();
    }, [refreshTrigger]);

    const loadConstructions = async () => {
        try {
            const data = await getConstructions(projectId);
            setConstructions(data);
        } catch (error) {
            console.error("Failed to load constructions:", error);
        }
    };

    const loadProjectStats = async () => {
        try {
            const stats = await getProjectStats(projectId);
            setProjectStats(stats);
            const proj = await getProject(projectId);
            setProject(proj);

            // Sync Ventilation Config (Mode & ALD) & Recalculate n50 if needed
            if (proj && proj.ventilationConfig) {
                const units = proj.ventilationUnits || [];
                const hasMechanical = units.length > 0;
                const mode = hasMechanical ? "mechanical" : "natural";

                // ALD Logic
                let shouldHaveALD = proj.ventilationConfig.hasALD;
                if (mode === "mechanical") {
                    shouldHaveALD = units.some(u => u.type === "exhaust");
                }

                // Check if n50 needs update (Standard calculation relies on Volume/Area which might have changed)
                let newN50 = proj.ventilationConfig.n50;
                let n50Changed = false;

                if (!proj.ventilationConfig.isMeasured) {
                    // Recalculate standard n50 using implicit stats (from getProjectStats earlier)
                    // Note: 'stats' variable holds the fresh stats
                    const calculatedN50 = calculateStandardN50(
                        stats.totalVolume,
                        stats.totalEnvelopeArea,
                        mode,
                        proj.ventilationConfig.infiltrationCategory || "I"
                    );

                    // Compare with stored value (allow small float diff)
                    if (Math.abs(calculatedN50 - proj.ventilationConfig.n50) > 0.0001) {
                        newN50 = calculatedN50;
                        n50Changed = true;
                    }
                }

                if (proj.ventilationConfig.type !== mode
                    || (mode === "mechanical" && proj.ventilationConfig.hasALD !== shouldHaveALD)
                    || n50Changed
                ) {
                    // Need update
                    await updateProjectVentilation(projectId, {
                        ...proj.ventilationConfig,
                        type: mode,
                        hasALD: shouldHaveALD,
                        n50: newN50
                    });

                    // Update state directly to reflect changes immediately
                    setProject({
                        ...proj,
                        ventilationConfig: {
                            ...proj.ventilationConfig,
                            type: mode,
                            hasALD: shouldHaveALD,
                            n50: newN50
                        }
                    });
                }
            }

        } catch (error) {
            console.error("Failed to load project stats:", error);
        }
    };

    const loadZones = async () => {
        try {
            const data = await getZones(projectId);
            setZones(data);
        } catch (error) {
            console.error("Failed to load zones:", error);
        }
    };



    const handleAddZone = () => {
        setSelectedZone(undefined);
        setViewMode("form");
    };

    const handleEditZone = (zone: Zone) => {
        setSelectedZone(zone);
        setViewMode("form");
    };

    const handleOpenZone = (zone: Zone) => {
        setSelectedZone(zone);
        setViewMode("form");
    };

    const handleFormSuccess = (zone: Zone) => {
        setSelectedZone(zone);
        setViewMode("form");
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleFormCancel = () => {
        setViewMode("list");
    };

    const handleAddSurface = () => {
        setSelectedSurface(undefined);
        setViewMode("surface-form");
    };

    const handleEditSurface = (surface: any) => {
        setSelectedSurface(surface);
        setViewMode("surface-form");
    };

    const handleSurfaceFormSuccess = () => {
        setViewMode("form");
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleSurfaceFormCancel = () => {
        setViewMode("form");
    };

    const handleConstructionUpdate = async (updatedList: Construction[]) => {
        setConstructions(updatedList);
    };




    return (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
            <TabsList>
                <TabsTrigger value="zones">존 관리 (Zones)</TabsTrigger>
                <TabsTrigger value="constructions">외피 유형 (Assemblies)</TabsTrigger>
            </TabsList>

            <TabsContent value="zones" className="space-y-4">
                {(viewMode === "form" || viewMode === "surface-form") ? (
                    viewMode === "surface-form" && selectedZone ? (
                        <div className="space-y-4 max-w-3xl mx-auto">
                            <Button variant="ghost" size="sm" onClick={() => setViewMode("form")} className="mb-2">
                                <ArrowLeft className="mr-2 h-4 w-4" /> {selectedZone!.name} 수정으로 돌아가기
                            </Button>
                            <div className="bg-card border rounded-lg p-6 shadow-sm">
                                <h2 className="text-xl font-semibold mb-1">
                                    {selectedSurface ? "표면 수정" : "새로운 표면 추가"}
                                </h2>
                                <p className="text-sm text-muted-foreground mb-6">
                                    {selectedZone!.name}에 속한 표면 정보를 입력하세요.
                                </p>
                                <SurfaceForm
                                    projectId={projectId}
                                    zoneId={selectedZone!.id!}
                                    surface={selectedSurface}
                                    onSuccess={handleSurfaceFormSuccess}
                                    onCancel={handleSurfaceFormCancel}
                                    constructions={constructions}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 max-w-3xl mx-auto">
                            <Button variant="ghost" size="sm" onClick={() => setViewMode("list")} className="mb-2">
                                <ArrowLeft className="mr-2 h-4 w-4" /> 존 목록으로 돌아가기
                            </Button>

                            <div className="bg-card border rounded-lg p-6 shadow-sm">
                                <h2 className="text-xl font-semibold mb-4">
                                    {selectedZone ? "존 수정" : "새로운 존 추가"}
                                </h2>

                                <ZoneForm
                                    projectId={projectId}
                                    zone={selectedZone}
                                    onSuccess={handleFormSuccess}
                                    onCancel={handleFormCancel}
                                    projectStats={projectStats}
                                    projectVentilation={project?.ventilationConfig}
                                    units={project?.ventilationUnits}
                                    systems={project?.systems}
                                    renderEnvelope={() => (
                                        selectedZone && selectedZone.id ? (
                                            <EnvelopeSection
                                                selectedZone={selectedZone}
                                                projectId={projectId}
                                                handleAddSurface={handleAddSurface}
                                                handleEditSurface={handleEditSurface}
                                                refreshTrigger={refreshTrigger}
                                                constructions={constructions}
                                                setSelectedZone={setSelectedZone}
                                                handleFormSuccess={handleFormSuccess}
                                            />
                                        ) : null
                                    )}
                                />
                            </div >
                        </div>
                    )
                ) : (
                    <>
                        {/* Project Ventilation Settings Card */}
                        {project && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>외피 기밀성 및 침기 설정 (Air Tightness & Infiltration)</CardTitle>
                                    <CardDescription>
                                        건물 전체의 기밀 등급과 적용 침기율(<Latex formula="n_{50}" />)을 설정합니다. 기계 환기 설비가 있는 경우 더 엄격한 기밀성이 요구됩니다.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                                        {/* Col 1: Category */}
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-center gap-2 mb-2 h-6">
                                                <Label className="font-semibold text-slate-700">기밀 등급 (Category)</Label>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <div className="text-xs space-y-1">
                                                                <p>I: 기밀성 검증 완료</p>
                                                                <p>II: 신축 건물 (표준)</p>
                                                                <p>III: 기존 건물</p>
                                                                <p>IV: 노후 건물</p>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            <div className="mt-auto">
                                                <Select
                                                    value={project.ventilationConfig?.infiltrationCategory || "I"}
                                                    onValueChange={(val: "I" | "II" | "III" | "IV") => {
                                                        const hasMechanical = (project.systems?.some(s => s.type === "AHU") ?? false);
                                                        const mode: "natural" | "mechanical" = hasMechanical ? "mechanical" : "natural";

                                                        const newN50 = project.ventilationConfig?.isMeasured
                                                            ? project.ventilationConfig.n50
                                                            : calculateStandardN50(
                                                                projectStats.totalVolume,
                                                                projectStats.totalEnvelopeArea,
                                                                mode,
                                                                val
                                                            );

                                                        const newConfig = {
                                                            ...project.ventilationConfig!,
                                                            infiltrationCategory: val,
                                                            type: mode,
                                                            n50: newN50
                                                        };
                                                        updateProjectVentilation(projectId, newConfig).then(() => {
                                                            loadProjectStats();
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="I">Category I (검증됨)</SelectItem>
                                                        <SelectItem value="II">Category II (신축)</SelectItem>
                                                        <SelectItem value="III">Category III (기존)</SelectItem>
                                                        <SelectItem value="IV">Category IV (노후)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Col 2: n50 Result */}
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-center justify-between mb-2 h-6">
                                                <div className="flex items-center gap-2">
                                                    <Label className="font-semibold text-slate-700">적용 침기율 (<Latex formula="n_{50}" />)</Label>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <div className="text-xs max-w-[200px]">
                                                                    건물 내외의 압력차가 50Pa일 때의 시간당 환기 횟수(<Latex formula="h^{-1}" />)를 나타냅니다.
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="n50-measured"
                                                        checked={project.ventilationConfig?.isMeasured || false}
                                                        onCheckedChange={(checked) => {
                                                            const isMeasured = checked === true;
                                                            const hasMechanical = (project.systems?.some(s => s.type === "AHU") ?? false);
                                                            const mode: "natural" | "mechanical" = hasMechanical ? "mechanical" : "natural";
                                                            const cat = project.ventilationConfig?.infiltrationCategory || "I";

                                                            const n50 = isMeasured
                                                                ? (project.ventilationConfig?.n50 || 2.0)
                                                                : calculateStandardN50(projectStats.totalVolume, projectStats.totalEnvelopeArea, mode, cat);

                                                            const newConfig = {
                                                                ...project.ventilationConfig!,
                                                                n50: n50,
                                                                isMeasured: isMeasured,
                                                                type: mode
                                                            };

                                                            updateProjectVentilation(projectId, newConfig).then(() => {
                                                                loadProjectStats();
                                                            });
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor="n50-measured"
                                                        className="text-[11px] text-muted-foreground font-medium leading-none cursor-pointer"
                                                    >
                                                        직접 입력
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="mt-auto">
                                                {project.ventilationConfig?.isMeasured ? (
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        className="h-10 text-center font-mono text-base"
                                                        value={project.ventilationConfig?.n50 || 0}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            if (project) setProject({ ...project, ventilationConfig: { ...project.ventilationConfig!, n50: val } });
                                                        }}
                                                        onBlur={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const newConfig = { ...project.ventilationConfig!, n50: val, isMeasured: true };
                                                            updateProjectVentilation(projectId, newConfig).then(() => loadProjectStats());
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center p-2 bg-slate-50/50 rounded-md border border-slate-200 font-mono text-lg font-bold text-slate-800 h-10 shadow-sm transition-all">
                                                        {(project.ventilationConfig?.n50 || 0).toFixed(2)} <span className="ml-1 text-sm text-slate-400 font-normal">h⁻¹</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Col 3: ALD Settings */}
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-center gap-2 mb-2 h-6">
                                                <Label className="font-semibold text-slate-700">추가 설정</Label>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <div className="text-xs max-w-[200px]">
                                                                ALD(Outside Air Inlet)는 기밀한 공간의 안정적인 공기 도입을 위한 보조 장치 설정을 의미합니다.
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            <div className="mt-auto bg-slate-50/30 p-3 rounded-md border border-dashed border-slate-200 min-h-[70px] flex flex-col justify-center">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="has-ald"
                                                        checked={project.ventilationConfig?.hasALD || false}
                                                        onCheckedChange={(checked) => {
                                                            const newConfig = {
                                                                ...project.ventilationConfig!,
                                                                hasALD: checked === true
                                                            };
                                                            updateProjectVentilation(projectId, newConfig).then(() => {
                                                                loadProjectStats();
                                                            });
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor="has-ald"
                                                        className="text-sm font-bold text-slate-800 leading-none cursor-pointer"
                                                    >
                                                        외부 공기 유입구 (ALD)
                                                    </label>
                                                </div>
                                                <div className="mt-2 pl-6">
                                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                                        {project.ventilationConfig?.type === "mechanical"
                                                            ? "배기 시스템 구성 시 ALD를 통한 공기 유입을 고려합니다."
                                                            : <span className="flex items-center gap-1 italic">침기율 계산 시 ALD의 영향(<Latex formula="f_{ATD}" />)을 고려합니다.</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                                <div className="space-y-1.5">
                                    <CardTitle>건물 형상 (Geometry)</CardTitle>
                                    <CardDescription>
                                        건물의 존(Zone)과 외피(Surface) 정보를 관리합니다.
                                    </CardDescription>
                                </div>
                                <Button onClick={handleAddZone}>
                                    <Plus className="mr-2 h-4 w-4" /> 존 추가
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <ZoneList
                                    projectId={projectId}
                                    onEdit={handleEditZone}
                                    onViewDetail={handleOpenZone}
                                    refreshTrigger={refreshTrigger}
                                    onZoneChange={loadProjectStats}
                                    availableUnits={project?.ventilationUnits}
                                />
                            </CardContent>
                        </Card>
                    </>
                )}
            </TabsContent>

            <TabsContent value="constructions">
                <Card>
                    <CardHeader>
                        <CardTitle>외피 유형 관리 (Assembly Manager)</CardTitle>
                        <CardDescription>
                            벽, 창, 지붕 등의 외피 유형(Assembly)을 정의하고 열관류율(U-value)을 관리합니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ConstructionManager
                            constructions={constructions}
                            projectId={projectId}
                            onUpdate={() => {
                                loadConstructions();
                                setRefreshTrigger((prev) => prev + 1);
                            }}
                        />
                    </CardContent>
                </Card>
            </TabsContent>


        </Tabs >
    );
}

// Helper Component for Collapsible Sections
function CollapsibleSection({
    title,
    description,
    children,
    defaultOpen = false,
    headerAction
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    headerAction?: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsOpen(!isOpen)}>
                <div className="space-y-1 select-none">
                    <CardTitle className="text-base">{title}</CardTitle>
                    {description && <CardDescription>{description}</CardDescription>}
                </div>
                <div className="flex items-center gap-2">
                    {headerAction}
                    <div className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted transition-colors">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                </div>
            </CardHeader>
            {isOpen && (
                <CardContent className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    {children}
                </CardContent>
            )}
        </Card>
    );
}

// Extracted Envelope Section
function EnvelopeSection({
    selectedZone,
    projectId,
    handleAddSurface,
    handleEditSurface,
    refreshTrigger,
    constructions,
    setSelectedZone,
    handleFormSuccess
}: {
    selectedZone: Zone;
    projectId: string;
    handleAddSurface: () => void;
    handleEditSurface: (surface: any) => void;
    refreshTrigger: number;
    constructions: Construction[];
    setSelectedZone: (zone: Zone) => void;
    handleFormSuccess: (zone: Zone) => void;
}) {
    return (
        <CollapsibleSection
            title="외피 (Envelope) 구성"
            description="이 존을 구성하는 벽체, 창호, 지붕 등을 관리합니다."
            defaultOpen={true}
            headerAction={
                <Button onClick={(e) => { e.stopPropagation(); handleAddSurface(); }} size="sm" variant="outline" type="button">
                    <Plus className="mr-2 h-4 w-4" /> 표면 추가
                </Button>
            }
        >
            {/* Thermal Bridge Setting */}
            <div className="flex flex-col gap-2 p-3 border rounded-md bg-muted/20">
                <Label className="text-sm font-medium">열교 (Thermal Bridge)</Label>
                <Select
                    value={(selectedZone.thermalBridgeMode || 0.10).toFixed(2)}
                    onValueChange={async (val) => {
                        const newValue = Number(val);
                        if (selectedZone.id) {
                            const updated = { ...selectedZone, thermalBridgeMode: newValue };
                            setSelectedZone(updated); // Optimistic UI update
                            try {
                                await updateZone(projectId, selectedZone.id, { thermalBridgeMode: newValue });
                                handleFormSuccess(updated); // Refresh parent state
                            } catch (e) {
                                console.error("Failed to update thermal bridge:", e);
                            }
                        }
                    }}
                >
                    <SelectTrigger className="w-full md:w-[400px] bg-background">
                        <SelectValue placeholder="열교 유형 선택" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0.10">일반적인 경우 (0.10 W/m²K)</SelectItem>
                        <SelectItem value="0.05">단열상세 규정 준수 (0.05 W/m²K)</SelectItem>
                        <SelectItem value="0.15">내단열인 경우 (0.15 W/m²K)</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    선형 열관류율(Ψ)에 대한 보정값입니다. 상세 계산을 하지 않는 경우 선택하세요.
                </p>
            </div>

            <SurfaceList
                projectId={projectId}
                zoneId={selectedZone.id!}
                onEdit={handleEditSurface}
                refreshTrigger={refreshTrigger}
                constructions={constructions}
            />
        </CollapsibleSection>
    );
}
