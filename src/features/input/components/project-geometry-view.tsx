"use client";

import { SystemGraphView } from "@/features/systems/components/system-graph-view";
import { LayoutList, Network } from "lucide-react";
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
import { SystemList } from "@/features/systems/components/system-list";
import { SystemForm } from "@/features/systems/components/system-form";
import { addSystem, updateSystem, deleteSystem } from "@/services/system-service";
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
    const [viewMode, setViewMode] = useState<"list" | "form" | "zone-detail" | "surface-form" | "system-form">("list");
    const [selectedTab, setSelectedTab] = useState("zones");
    const [constructions, setConstructions] = useState<Construction[]>([]);
    const [projectStats, setProjectStats] = useState<ProjectStats>({ totalVolume: 0, totalEnvelopeArea: 0 });
    const [project, setProject] = useState<Project | null>(null);
    const [selectedZone, setSelectedZone] = useState<Zone | undefined>(undefined);
    const [selectedSurface, setSelectedSurface] = useState<any | undefined>(undefined);
    const [selectedSystem, setSelectedSystem] = useState<BuildingSystem | undefined>(undefined);
    const [zones, setZones] = useState<Zone[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isSystemGraphMode, setIsSystemGraphMode] = useState(false);
    const [deleteSystemConfirmOpen, setDeleteSystemConfirmOpen] = useState(false);
    const [systemToDelete, setSystemToDelete] = useState<{ id: string; name: string } | null>(null);

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

    // System Handlers
    const handleAddSystem = () => {
        setSelectedSystem(undefined);
        setViewMode("system-form");
    };

    const handleEditSystem = (sys: BuildingSystem) => {
        setSelectedSystem(sys);
        setViewMode("system-form");
    };

    const handleDeleteSystemClick = (id: string) => {
        const sys = project?.systems?.find(s => s.id === id);
        if (sys) {
            setSystemToDelete({ id, name: sys.name });
            setDeleteSystemConfirmOpen(true);
        }
    };

    const confirmDeleteSystem = async () => {
        if (!systemToDelete) return;
        try {
            await deleteSystem(projectId, systemToDelete.id);
            setDeleteSystemConfirmOpen(false);
            setSystemToDelete(null);
            loadProjectStats(); // Re-fetch project to update list
        } catch (e) {
            console.error("Failed to delete system:", e);
            alert("삭제 실패");
        }
    };

    const handleSystemSave = async (sys: BuildingSystem) => {
        try {
            if (selectedSystem) {
                await updateSystem(projectId, sys);
            } else {
                await addSystem(projectId, sys);
            }
            setViewMode("list");
            loadProjectStats(); // Refresh project
        } catch (e) {
            console.error("Failed to save system:", e);
        }
    };

    if (viewMode === "form") {
        return (
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
        );
    }

    if (viewMode === "system-form") {
        return (
            <div className="space-y-6 max-w-3xl mx-auto">
                <Button variant="ghost" size="sm" onClick={() => setViewMode("list")} className="mb-2">
                    <ArrowLeft className="mr-2 h-4 w-4" /> 시스템 목록으로 돌아가기
                </Button>
                <SystemForm
                    projectId={projectId}
                    system={selectedSystem}
                    zones={zones}
                    onSave={handleSystemSave}
                    onCancel={() => setViewMode("list")}
                />
            </div>
        );
    }

    if (viewMode === "surface-form" && selectedZone) {
        return (
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
        );
    }

    return (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
            <TabsList>
                <TabsTrigger value="zones">존 관리 (Zones)</TabsTrigger>
                <TabsTrigger value="constructions">외피 유형 (Assemblies)</TabsTrigger>
                <TabsTrigger value="systems">설비 (Systems)</TabsTrigger>
            </TabsList>

            <TabsContent value="zones" className="space-y-4">
                {/* Project Ventilation Settings Card */}
                {project && (
                    <Card>
                        <CardHeader>
                            <CardTitle>외피 기밀성 및 침기 설정 (Air Tightness & Infiltration)</CardTitle>
                            <CardDescription>
                                건물 전체의 기밀 등급과 침기율(n50)을 설정합니다. 기계 환기 설비가 있는 경우 더 엄격한 기밀성이 요구됩니다.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                                {/* Col 1: Category */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label>기밀 등급 (Category)</Label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>I: 기밀성 검증 완료</p>
                                                    <p>II: 신축 건물 (표준)</p>
                                                    <p>III: 기존 건물</p>
                                                    <p>IV: 노후 건물</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Select
                                        value={project.ventilationConfig?.infiltrationCategory || "I"}
                                        onValueChange={(val: "I" | "II" | "III" | "IV") => {
                                            // Determine mode based on AHU system presence
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
                                                type: mode, // Update mode as well
                                                n50: newN50
                                            };
                                            updateProjectVentilation(projectId, newConfig).then(() => {
                                                loadProjectStats();
                                            });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="I">Category I (검증됨)</SelectItem>
                                            <SelectItem value="II">Category II (신축)</SelectItem>
                                            <SelectItem value="III">Category III (기존)</SelectItem>
                                            <SelectItem value="IV">Category IV (노후)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Col 2: n50 Result */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>적용 침기율 (n50)</Label>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="n50-measured"
                                                checked={project.ventilationConfig?.isMeasured || false}
                                                onCheckedChange={(checked) => {
                                                    const isMeasured = checked === true;
                                                    // Determine mode based on AHU system presence
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
                                                className="text-xs text-muted-foreground font-medium leading-none cursor-pointer"
                                            >
                                                직접 입력
                                            </label>
                                        </div>
                                    </div>

                                    {project.ventilationConfig?.isMeasured ? (
                                        <Input
                                            type="number"
                                            step="0.01"
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
                                        <div className="flex items-center justify-center p-2 bg-muted rounded-md border font-mono text-lg font-medium h-10">
                                            {(project.ventilationConfig?.n50 || 0).toFixed(2)} <span className="ml-1 text-sm text-muted-foreground">h⁻¹</span>
                                        </div>
                                    )}
                                </div>

                                {/* Col 3: ALD (Automatic for Mechanical, Manual for Natural) */}
                                <div className="space-y-4 pt-8">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="has-ald"
                                            checked={project.ventilationConfig?.hasALD || false}
                                            disabled={project.ventilationConfig?.type === "mechanical"}
                                            onCheckedChange={(checked) => {
                                                const newConfig = {
                                                    ...project.ventilationConfig!,
                                                    hasALD: checked === true
                                                };
                                                updateProjectVentilation(projectId, newConfig);
                                            }}
                                        />
                                        <label
                                            htmlFor="has-ald"
                                            className="text-sm font-medium leading-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            외부 공기 유입구 (ALD)
                                        </label>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {project.ventilationConfig?.type === "mechanical"
                                            ? "기계 환기 시 시스템 구성에 따라 자동 결정됩니다. (배기 전용: 켜짐, 급/배기: 꺼짐)"
                                            : "침기율 계산 시 ALD의 영향(f_ATD)을 고려합니다."}
                                    </p>
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
                            onUpdate={loadConstructions}
                        />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="systems">
                {/* Thermal Systems */}
                <Card className="mb-6">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="space-y-1.5">
                            <CardTitle>열원 및 설비 시스템 (Thermal Systems)</CardTitle>
                            <CardDescription>
                                난방, 냉방, 급탕(DHW) 및 태양광 시스템을 정의하고 존과 연결합니다.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 bg-muted p-1 rounded-md">
                            <Button
                                variant={!isSystemGraphMode ? "secondary" : "ghost"}
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => setIsSystemGraphMode(false)}
                            >
                                <LayoutList className="h-4 w-4 mr-1" /> 목록
                            </Button>
                            <Button
                                variant={isSystemGraphMode ? "secondary" : "ghost"}
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => setIsSystemGraphMode(true)}
                            >
                                <Network className="h-4 w-4 mr-1" /> 다이어그램
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isSystemGraphMode ? (
                            <SystemGraphView
                                systems={project?.systems || []}
                                zones={zones}
                            />
                        ) : (
                            <SystemList
                                projectId={projectId}
                                systems={project?.systems || []}
                                onAdd={handleAddSystem}
                                onEdit={handleEditSystem}
                                onDelete={handleDeleteSystemClick}
                            />
                        )}
                    </CardContent>
                </Card>

                <Dialog open={deleteSystemConfirmOpen} onOpenChange={setDeleteSystemConfirmOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>설비 삭제 확인</DialogTitle>
                            <DialogDescription>
                                정말로 &apos;{systemToDelete?.name}&apos; 설비를 삭제하시겠습니까?
                                이 작업은 되돌릴 수 없으며 존에 연결된 설비 정보가 해제됩니다.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setDeleteSystemConfirmOpen(false)}>
                                취소
                            </Button>
                            <Button variant="destructive" onClick={confirmDeleteSystem}>
                                삭제
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Mechanical Ventilation - Deprecated in favor of AHU Systems */}
                {/* 
                <Card>
                    <CardHeader>
                        <CardTitle>기계 환기 장비 (Ventilation Units)</CardTitle>
                        <CardDescription>
                            공조기(AHU), 전열교환기(ERV) 등 주요 기계 환기 장비를 정의합니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {project && (
                            <VentilationUnitManager
                                projectId={projectId}
                                units={project.ventilationUnits || []}
                                onUpdate={loadProjectStats} // Re-fetch project to update list
                            />
                        )}
                    </CardContent>
                </Card> 
                */}
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
