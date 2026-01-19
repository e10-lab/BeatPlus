"use client";

import { useEffect, useState } from "react";
import { Surface } from "@/types/project";
import { getSurfaces, deleteSurface } from "@/services/surface-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Layers, Compass, Scaling } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { Construction } from "@/types/project";

interface SurfaceListProps {
    projectId: string;
    zoneId: string;
    onEdit: (surface: Surface) => void;
    refreshTrigger: number;
    constructions?: Construction[];
}

export function SurfaceList({ projectId, zoneId, onEdit, refreshTrigger, constructions = [] }: SurfaceListProps) {
    const [surfaces, setSurfaces] = useState<Surface[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSurfaces = async () => {
        setLoading(true);
        try {
            const data = await getSurfaces(projectId, zoneId);
            setSurfaces(data);
        } catch (error) {
            console.error("Failed to fetch surfaces:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (zoneId) {
            fetchSurfaces();
        }
    }, [projectId, zoneId, refreshTrigger]);

    const handleDelete = async (surfaceId: string) => {
        if (confirm("정말로 이 표면을 삭제하시겠습니까?")) {
            try {
                await deleteSurface(projectId, zoneId, surfaceId);
                fetchSurfaces();
            } catch (error) {
                console.error("Failed to delete surface:", error);
                alert("삭제 실패");
            }
        }
    };

    if (loading) return <div className="text-center py-8">로딩 중...</div>;

    if (surfaces.length === 0) {
        return (
            <div className="text-center py-8 border rounded-lg bg-muted/10 dashed border-muted-foreground/20">
                <Layers className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">등록된 표면이 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {surfaces.map((surface) => (
                <div key={surface.id} className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-accent/50 transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <Layers className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{surface.name}</span>
                                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5">
                                    {surface.type.replace('_', ' ')}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <div className="flex items-center gap-1">
                                    <Scaling className="h-3 w-3" />
                                    {surface.area} m²
                                </div>
                                <div className="flex items-center gap-1">
                                    <span>U: {surface.uValue}</span>
                                </div>
                                {surface.constructionId && constructions.length > 0 && (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-[10px]">
                                        <Layers className="h-3 w-3" />
                                        {constructions.find(c => c.id === surface.constructionId)?.name || "Unknown"}
                                    </div>
                                )}
                                {surface.orientation && (
                                    <div className="flex items-center gap-1">
                                        <Compass className="h-3 w-3" />
                                        {surface.orientation} ({surface.tilt}°)
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(surface)}>
                            <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => surface.id && handleDelete(surface.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
