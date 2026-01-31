"use client";

import { useEffect, useState } from "react";
import { Zone, Surface, VentilationUnit } from "@/types/project";
import { getZones, deleteZone, reorderZones } from "@/services/zone-service";
import { getSurfaces } from "@/services/surface-service";
import { getConstructions } from "@/services/construction-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Edit2, Trash2, Box, Thermometer, Ruler, MoveVertical, Cuboid, Info, Eye, EyeOff
} from "lucide-react";
import { updateZone } from "@/services/zone-service";
import { DIN_18599_PROFILES } from "@/lib/din-18599-profiles";
import { SurfaceIcon } from "@/components/ui/icons/surface-icon";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// DnD Kit Imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ZoneListProps {
    projectId: string;
    onEdit: (zone: Zone) => void;
    onViewDetail: (zone: Zone) => void;
    refreshTrigger: number;
    onZoneChange?: () => void;
    availableUnits?: VentilationUnit[]; // Pass units for linking in forms
}

const getUsageName = (id: string) => {
    return DIN_18599_PROFILES[id]?.name || id;
};



const getSurfaceLabel = (type: string) => {
    switch (type) {
        case "wall_exterior": return "외벽";
        case "wall_interior": return "내벽";
        case "wall_ground": return "지중벽";
        case "roof_exterior": return "지붕";
        case "floor_ground": return "바닥";
        case "floor_exterior": return "외기바닥";
        case "window": return "창호";
        case "door": return "문";
        default: return "기타";
    }
}


function SortableZoneCard({ zone, projectId, onEdit, onViewDetail, onDelete, onToggleExclusion, constructionMap }: {
    zone: Zone;
    projectId: string;
    onEdit: (zone: Zone) => void;
    onViewDetail: (zone: Zone) => void;
    onDelete: (id: string) => void;
    onToggleExclusion: (zone: Zone) => void;
    constructionMap: Record<string, string>;
}) {
    const [surfaces, setSurfaces] = useState<Surface[]>([]);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: zone.id! });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        opacity: isDragging ? 0.5 : 1,
    };

    useEffect(() => {
        let isMounted = true;
        const loadSurfaces = async () => {
            if (!zone.id) return;
            try {
                const data = await getSurfaces(projectId, zone.id);
                if (isMounted) setSurfaces(data);
            } catch (err) {
                console.error("Failed to load surfaces for zone", zone.id, err);
            }
        };
        loadSurfaces();

        return () => { isMounted = false; };
    }, [projectId, zone.id]);

    return (
        <div ref={setNodeRef} style={style} className="h-full" {...attributes} {...listeners}>
            <Card
                className={`relative group cursor-pointer hover:border-primary transition-all flex flex-col h-full ${isDragging ? "ring-2 ring-primary" : ""} ${zone.isExcluded ? "opacity-60 bg-muted/30" : ""}`}
                onClick={() => {
                    if (!isDragging) onViewDetail(zone);
                }}
            >
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Box className={`h-4 w-4 ${zone.isExcluded ? "text-muted-foreground" : "text-primary"}`} />
                            <span className="truncate">{zone.name}</span>
                            {zone.isExcluded && (
                                <span className="text-xs font-normal bg-muted text-muted-foreground px-2 py-0.5 rounded-full ml-2">
                                    제외됨
                                </span>
                            )}
                        </CardTitle>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-muted"
                                title={zone.isExcluded ? "계산에 포함시키기" : "계산에서 제외하기"}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleExclusion(zone);
                                }}
                            >
                                {zone.isExcluded ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-muted"
                                onPointerDown={(e) => e.stopPropagation()}
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
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    zone.id && onDelete(zone.id);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="text-sm space-y-3 flex-1">
                    {/* Usage Info */}
                    <div className="flex justify-between border-b pb-1">
                        <span className="text-muted-foreground text-xs">용도</span>
                        <span className="font-medium text-xs truncate max-w-[150px]" title={getUsageName(zone.usageType)}>
                            {getUsageName(zone.usageType)}
                        </span>
                    </div>

                    {/* Geometry Info */}
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1.5" title="바닥 면적">
                            <Ruler className="h-3.5 w-3.5" />
                            <span>{zone.area} m²</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="천정고">
                            <MoveVertical className="h-3.5 w-3.5" />
                            <span>{zone.height} m</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="체적">
                            <Cuboid className="h-3.5 w-3.5" />
                            <span>{(zone.volume || 0).toFixed(1)} m³</span>
                        </div>
                    </div>

                    {/* Setpoints */}
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

                    {/* Surface Icons Section */}
                    <div className="pt-2 border-t mt-2">
                        <div className="flex flex-wrap gap-2">
                            {surfaces.length === 0 ? (
                                <span className="text-xs text-muted-foreground">외피 없음</span>
                            ) : (
                                <TooltipProvider>
                                    {surfaces.map((surf, idx) => (
                                        <Tooltip key={surf.id || idx} delayDuration={300}>
                                            <TooltipTrigger asChild>
                                                <div className="p-1.5 rounded-md bg-muted/50 hover:bg-primary/10 transition-colors cursor-help border" onPointerDown={(e) => e.stopPropagation()}>
                                                    <SurfaceIcon type={surf.type} className="h-4 w-4" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-xs p-2">
                                                <div className="font-semibold mb-1 flex items-center gap-2">
                                                    <SurfaceIcon type={surf.type} className="h-4 w-4" />
                                                    <span>{surf.name}</span>
                                                    <span className="text-muted-foreground font-normal">({getSurfaceLabel(surf.type)})</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                    {surf.constructionId && constructionMap[surf.constructionId] && (
                                                        <>
                                                            <span className="text-muted-foreground">외피 유형:</span>
                                                            <span className="font-medium text-primary">{constructionMap[surf.constructionId]}</span>
                                                        </>
                                                    )}
                                                    <span className="text-muted-foreground">면적:</span>
                                                    <span>{surf.area} m²</span>
                                                    <span className="text-muted-foreground">열관류율:</span>
                                                    <span>{surf.uValue?.toFixed(3) || '-'} W/m²K</span>
                                                    {surf.orientation && (
                                                        <>
                                                            <span className="text-muted-foreground">방위:</span>
                                                            <span>{surf.orientation}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    ))}
                                </TooltipProvider>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function ZoneList({ projectId, onEdit, onViewDetail, refreshTrigger, onZoneChange, availableUnits = [] }: ZoneListProps) {
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [constructionMap, setConstructionMap] = useState<Record<string, string>>({});
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [zoneToDelete, setZoneToDelete] = useState<{ id: string; name: string } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [zonesData, constructionsData] = await Promise.all([
                getZones(projectId),
                getConstructions(projectId)
            ]);
            setZones(zonesData);

            // Create map of ID -> Name
            const map: Record<string, string> = {};
            constructionsData.forEach(c => {
                map[c.id] = c.name;
            });
            setConstructionMap(map);

        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [projectId, refreshTrigger]);

    const handleDeleteClick = (zoneId: string) => {
        const zone = zones.find(z => z.id === zoneId);
        if (zone) {
            setZoneToDelete({ id: zoneId, name: zone.name });
            setDeleteConfirmOpen(true);
        }
    };

    const confirmDelete = async () => {
        if (!zoneToDelete) return;
        try {
            await deleteZone(projectId, zoneToDelete.id);
            setDeleteConfirmOpen(false);
            setZoneToDelete(null);
            fetchData(); // Refresh list
            if (onZoneChange) onZoneChange();
        } catch (error) {
            console.error("Failed to delete zone:", error);
            alert("삭제 실패");
        }
    };

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setZones((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                const newItems = arrayMove(items, oldIndex, newIndex);

                const orderedIds = newItems.map(item => item.id!);
                reorderZones(projectId, orderedIds).then(() => {
                    if (onZoneChange) onZoneChange();
                }).catch(err => {
                    console.error("Failed to reorder zones:", err);
                    fetchData(); // Revert on error
                });

                return newItems;
            });
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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={zones.map(z => z.id!)}
                strategy={rectSortingStrategy}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {zones.map((zone) => (
                        <SortableZoneCard
                            key={zone.id}
                            zone={zone}
                            projectId={projectId}
                            onEdit={onEdit}
                            onViewDetail={onViewDetail}
                            onDelete={handleDeleteClick}
                            onToggleExclusion={async (zone) => {
                                if (zone.id) {
                                    const newValue = !zone.isExcluded;

                                    // Prevent excluding if it's the last active zone
                                    if (newValue === true) { // If trying to exclude
                                        const activeZones = zones.filter(z => !z.isExcluded);
                                        if (activeZones.length <= 1 && activeZones[0].id === zone.id) {
                                            alert("적어도 하나의 존은 계산에 포함되어야 합니다.");
                                            return;
                                        }
                                    }

                                    // Optimistic update
                                    setZones(prev => prev.map(z => z.id === zone.id ? { ...z, isExcluded: newValue } : z));
                                    try {
                                        await updateZone(projectId, zone.id, { isExcluded: newValue });
                                        if (onZoneChange) onZoneChange();
                                    } catch (err) {
                                        console.error("Failed to update exclusion:", err);
                                        fetchData(); // Revert
                                    }
                                }
                            }}
                            constructionMap={constructionMap}
                        />
                    ))}
                </div>
            </SortableContext>

            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>존 삭제 확인</DialogTitle>
                        <DialogDescription>
                            정말로 &apos;{zoneToDelete?.name}&apos; 존을 삭제하시겠습니까?
                            이 작업은 되돌릴 수 없으며 존에 포함된 모든 표면(Surface) 정보가 함께 삭제됩니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                            취소
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            삭제
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DndContext>
    );
}
