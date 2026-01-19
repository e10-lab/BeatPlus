"use client";

import { useState } from "react";
import { Zone } from "@/types/project";
import { ZoneList } from "./zone-list";
import { ZoneForm } from "./zone-form";
import { SurfaceList } from "./surface-list";
import { SurfaceForm } from "./surface-form";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Construction } from "@/types/project";
import { ConstructionManager } from "./construction-manager";
import { getConstructions } from "@/services/construction-service";
import { useEffect } from "react";

interface ProjectGeometryViewProps {
    projectId: string;
}

export function ProjectGeometryView({ projectId }: ProjectGeometryViewProps) {
    const [viewMode, setViewMode] = useState<"list" | "form" | "zone-detail" | "surface-form">("list");
    const [selectedTab, setSelectedTab] = useState("zones");
    const [constructions, setConstructions] = useState<Construction[]>([]);

    // Load Constructions on Mount
    useEffect(() => {
        loadConstructions();
    }, [projectId]);

    const loadConstructions = async () => {
        try {
            const data = await getConstructions(projectId);
            setConstructions(data);
        } catch (error) {
            console.error("Failed to load constructions:", error);
        }
    };

    const [selectedZone, setSelectedZone] = useState<Zone | undefined>(undefined);
    const [selectedSurface, setSelectedSurface] = useState<any | undefined>(undefined); // Type should include Surface
    const [refreshTrigger, setRefreshTrigger] = useState(0);

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
        setViewMode("zone-detail");
    };

    const handleFormSuccess = () => {
        setViewMode("list");
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleFormCancel = () => {
        setViewMode("list");
    };

    // Surface Handlers
    const handleAddSurface = () => {
        setSelectedSurface(undefined);
        setViewMode("surface-form");
    };

    const handleEditSurface = (surface: any) => {
        setSelectedSurface(surface);
        setViewMode("surface-form");
    };

    const handleSurfaceFormSuccess = () => {
        setViewMode("zone-detail");
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleSurfaceFormCancel = () => {
        setViewMode("zone-detail");
    };

    // Construction Handlers
    const handleConstructionUpdate = async (updatedList: Construction[]) => {
        // This prop is generic update from manager, but manager usually handles save internally?
        // Actually ConstructionManager props are: constructions, projectId, onUpdate.
        // But ConstructionManager implementation handles SAVE internally via onSave callback loop?
        // Let's check ConstructionManager again.
        // It calls onUpdate with NEW LIST. It doesn't call service.
        // So we need to intercept the Save in ConstructionManager or pass a handler that does the service call.
        // Wait, ConstructionManager prop `onUpdate` expects the FULL list.
        // If I change ConstructionManager to handle persistence, I should change its props.
        // OR I keep ConstructionManager as UI-only and handle persistence here.
        // But ConstructionManager has the "Save" button logic inside `handleSave`.
        // Let's look at ConstructionManager line 20: `onUpdate(constructions.map...)` or `onUpdate([...])`.
        // It expects `onUpdate` to update the local state.
        // I should modify `ConstructionManager` to accept async `onSave` / `onDelete` instead of full list update? 
        // OR simply watch the list? No, that's bad for DB sync.

        // Better approach: Modify ConstructionManager to take `onSave` and `onDelete` props that return Promise.
        // But for now, since I can't easily change ConstructionManager's internal logic without viewing it again (I viewed it),
        // I will implement a wrapper or just use the updated list? 
        // No, using updated list means I have to diff to find what changed. That's inefficient.

        // Let's UPDATE ConstructionManager first to support direct Service calls? 
        // OR, just implement `onUpdate` here to do the DB calls.
        // But `onUpdate` provides the Whole List.
        // I'll stick to updating `ProjectGeometryView` to pass specific handlers if possible, 
        // but since `ConstructionManager` uses `onUpdate` with full list, I should probably REFACTOR ConstructionManager 
        // to be "Connected" or accept add/update/delete callbacks.

        // Let's Refactor ConstructionManager first.
        // But I am in the middle of replacing ProjectGeometryView.
        // I will inject the correct logic here assuming I WILL refactor ConstructionManager next.
        // Wait, I can't do that. 

        // Let's just load the constructions here. And pass them down.
        // And I will simply pass `setConstructions` to `onUpdate` for now to keep it working locally?
        // No, user wants persistence.

        // I will change `onUpdate` in `ProjectGeometryView` (this file) to NOT be used, 
        // and instead I'll pass a wrapped `ConstructionManager` that handles persistence?
        // No, I'll modify `ConstructionManager` in the NEXT step.
        // For THIS step, I will just set up the loading and leave the `onUpdate` as state update (transient) 
        // and THEN fix the persistence in Manager.
        // actually, `getConstructions` is async. 

        // Let's implement `loadConstructions` and pass `constructions` to `SurfaceForm`.
        setConstructions(updatedList);
    };

    // Sub-Views
    if (viewMode === "form") {
        return (
            <div className="space-y-4 max-w-3xl mx-auto">
                <Button variant="ghost" size="sm" onClick={() => setViewMode("list")} className="mb-2">
                    <ArrowLeft className="mr-2 h-4 w-4" /> 존 목록으로 돌아가기
                </Button>
                <div className="bg-card border rounded-lg p-6 shadow-sm">
                    <h2 className="text-xl font-semibold mb-1">
                        {selectedZone ? "존 수정" : "새로운 존 추가"}
                    </h2>
                    <ZoneForm
                        projectId={projectId}
                        zone={selectedZone}
                        onSuccess={handleFormSuccess}
                        onCancel={handleFormCancel}
                    />
                </div>
            </div>
        );
    }

    if (viewMode === "zone-detail" && selectedZone) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" size="sm" onClick={() => setViewMode("list")} className="-ml-2 mb-2">
                    <ArrowLeft className="mr-2 h-4 w-4" /> 존 목록으로
                </Button>

                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            {selectedZone.name}
                            <span className="text-sm font-normal text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                                {selectedZone.usageType}
                            </span>
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Area: {selectedZone.area}m², Height: {selectedZone.height}m
                        </p>
                    </div>
                    <Button onClick={handleAddSurface} size="sm">
                        <Plus className="mr-2 h-4 w-4" /> 표면 추가
                    </Button>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">외피 (Envelope) 구성</CardTitle>
                        <CardDescription>이 존을 구성하는 벽체, 창호, 지붕 등을 관리합니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SurfaceList
                            projectId={projectId}
                            zoneId={selectedZone.id!}
                            onEdit={handleEditSurface}
                            refreshTrigger={refreshTrigger}
                            constructions={constructions}
                        />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (viewMode === "surface-form" && selectedZone) {
        return (
            <div className="space-y-4 max-w-3xl mx-auto">
                <Button variant="ghost" size="sm" onClick={() => setViewMode("zone-detail")} className="mb-2">
                    <ArrowLeft className="mr-2 h-4 w-4" /> {selectedZone.name} 상세로 돌아가기
                </Button>
                <div className="bg-card border rounded-lg p-6 shadow-sm">
                    <h2 className="text-xl font-semibold mb-1">
                        {selectedSurface ? "표면 수정" : "새로운 표면 추가"}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        {selectedZone.name}에 속한 표면 정보를 입력하세요.
                    </p>
                    <SurfaceForm
                        projectId={projectId}
                        zoneId={selectedZone.id!}
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
                <TabsTrigger value="constructions">외피 유형 (Constructions)</TabsTrigger>
            </TabsList>

            <TabsContent value="zones">
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
                        />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="constructions">
                <Card>
                    <CardHeader>
                        <CardTitle>외피 유형 관리 (Construction Manager)</CardTitle>
                        <CardDescription>
                            벽, 창, 지붕 등의 구조체(Construction)를 정의하고 열관류율(U-value)을 관리합니다.
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
        </Tabs>
    );
}
