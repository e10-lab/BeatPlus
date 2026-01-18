"use client";

import { useState } from "react";
import { Zone } from "@/types/project";
import { ZoneList } from "./zone-list";
import { ZoneForm } from "./zone-form";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface ProjectGeometryViewProps {
    projectId: string;
}

export function ProjectGeometryView({ projectId }: ProjectGeometryViewProps) {
    const [viewMode, setViewMode] = useState<"list" | "form" | "zone-detail" | "surface-form">("list");
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
        // Dynamic import to avoid circular dependency if define in same file, or just import at top
        const { SurfaceList } = require("./surface-list");

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
                        />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (viewMode === "surface-form" && selectedZone) {
        const { SurfaceForm } = require("./surface-form");

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
                    />
                </div>
            </div>
        );
    }

    return (
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
                    onEdit={handleOpenZone}
                    refreshTrigger={refreshTrigger}
                />
            </CardContent>
        </Card>
    );
}
