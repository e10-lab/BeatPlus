"use client";

import { useEffect, useState } from "react";
import { Zone } from "@/types/project";
import { getZones, deleteZone } from "@/services/zone-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Box, Thermometer, Ruler } from "lucide-react";

interface ZoneListProps {
    projectId: string;
    onEdit: (zone: Zone) => void;
    refreshTrigger: number; // Simple way to trigger refresh from parent
}

export function ZoneList({ projectId, onEdit, refreshTrigger }: ZoneListProps) {
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchZones = async () => {
        setLoading(true);
        try {
            const data = await getZones(projectId);
            setZones(data);
        } catch (error) {
            console.error("Failed to fetch zones:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchZones();
    }, [projectId, refreshTrigger]);

    const handleDelete = async (zoneId: string) => {
        if (confirm("정말로 이 존을 삭제하시겠습니까?")) {
            try {
                await deleteZone(projectId, zoneId);
                fetchZones(); // Refresh list
            } catch (error) {
                console.error("Failed to delete zone:", error);
                alert("삭제 실패");
            }
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">존 목록 로딩 중...</div>;
    }

    if (zones.length === 0) {
        return (
            <div className="text-center py-12 border rounded-lg bg-muted/10 dashed border-muted-foreground/20">
                <Box className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-medium text-muted-foreground">등록된 존이 없습니다</h3>
                <p className="text-sm text-muted-foreground">새로운 존을 추가하여 건물을 정의하세요.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {zones.map((zone) => (
                <Card
                    key={zone.id}
                    className="relative group cursor-pointer hover:border-primary transition-all"
                    onClick={() => onEdit(zone)} // This now opens detail view
                >
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Box className="h-4 w-4 text-primary" />
                                {zone.name}
                            </CardTitle>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-muted"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(zone);
                                    }}
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        zone.id && handleDelete(zone.id);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        <div className="flex justify-between border-b pb-1">
                            <span className="text-muted-foreground">용도</span>
                            <span className="font-medium capitalize">{zone.usageType}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5" title="Area">
                                <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{zone.area} m²</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Height">
                                <span className="text-xs text-muted-foreground">H:</span>
                                <span>{zone.height} m</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Volume">
                                <span className="text-xs text-muted-foreground">V:</span>
                                <span>{zone.volume.toFixed(1)} m³</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 pt-1">
                            <div className="flex items-center gap-1.5 text-xs">
                                <Thermometer className="h-3.5 w-3.5 text-red-400" />
                                <span>{zone.temperatureSetpoints.heating}°C</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                                <Thermometer className="h-3.5 w-3.5 text-blue-400" />
                                <span>{zone.temperatureSetpoints.cooling}°C</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
