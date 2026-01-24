"use client";

import { useEffect, useState } from "react";
import { Surface } from "@/types/project";
import { getSurfaces, deleteSurface, reorderSurfaces } from "@/services/surface-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Construction } from "@/types/project";
import { SurfaceIcon } from "@/components/ui/icons/surface-icon";

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


interface SurfaceListProps {
    projectId: string;
    zoneId: string;
    onEdit: (surface: Surface) => void;
    refreshTrigger: number;
    constructions?: Construction[];
}

interface SortableSurfaceItemProps {
    surface: Surface;
    index: number;
    constructions: Construction[];
    onEdit: (surface: Surface) => void;
    onDelete: (id: string) => void;
}

function SortableSurfaceItem({ surface, index, constructions, onEdit, onDelete }: SortableSurfaceItemProps) {
    const constructionName = surface.constructionId
        ? constructions.find(c => c.id === surface.constructionId)?.name
        : undefined;
    const constructionSHGC = surface.constructionId
        ? constructions.find(c => c.id === surface.constructionId)?.shgc
        : undefined;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: surface.id! });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        opacity: isDragging ? 0.5 : 1,
    };

    // Helper to get Korean label for type (reused logic, ideally shared)
    const getTypeLabel = (type: string) => {
        if (type.startsWith("wall")) return "벽체";
        if (type.startsWith("roof")) return "지붕";
        if (type.startsWith("floor")) return "바닥";
        if (type === "window") return "창호";
        if (type === "door") return "문";
        return type;
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`relative grid grid-cols-[2fr_1fr_1fr_1fr_0.5fr_auto] gap-2 items-center p-3 border-b hover:bg-muted/30 transition-all group cursor-pointer ${isDragging ? "ring-2 ring-primary bg-muted" : "bg-card"}`}
            onClick={() => {
                if (!isDragging) onEdit(surface);
            }}
        >
            {/* 1. Type & Construction */}
            <div className="flex flex-col gap-1 min-w-0 pr-2">
                <div className="font-semibold text-sm truncate flex items-center gap-2">
                    <SurfaceIcon type={surface.type} />
                    {getTypeLabel(surface.type)}
                    {constructionName && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">
                            {constructionName}
                        </Badge>
                    )}
                </div>
            </div>

            {/* 2. U-Value & SHGC */}
            <div className="text-sm flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">U:</span>
                    <span className="font-mono font-medium">{surface.uValue.toFixed(3)}</span>
                </div>
                {constructionSHGC !== undefined && (
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">SHGC:</span>
                        <span className="font-mono text-blue-600">{constructionSHGC}</span>
                    </div>
                )}
            </div>

            {/* 3. Area */}
            <div className="text-sm">
                <span className="text-xs text-muted-foreground mr-1">면적:</span>
                <span className="font-medium">{surface.area} m²</span>
            </div>

            {/* 4. Orientation */}
            <div className="text-sm">
                {(surface.orientation || surface.tilt !== undefined) ? (
                    <div className="flex flex-col">
                        {surface.orientation && <span className="font-medium">{surface.orientation}</span>}
                        {surface.tilt !== undefined && <span className="text-xs text-muted-foreground">{surface.tilt}°</span>}
                    </div>
                ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                )}
            </div>

            {/* Spacer / Mobile adjustment could be needed, but sticking to simple grid */}
            <div></div>

            {/* 5. Actions */}
            <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onEdit(surface); }}>
                    <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); surface.id && onDelete(surface.id); }}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
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
            setSurfaces((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                const newItems = arrayMove(items, oldIndex, newIndex);

                const orderedIds = newItems.map(item => item.id!);
                reorderSurfaces(projectId, zoneId, orderedIds).catch(err => {
                    console.error("Failed to reorder surfaces:", err);
                    fetchSurfaces(); // Revert on error
                });

                return newItems;
            });
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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={surfaces.map(s => s.id!)}
                strategy={rectSortingStrategy}
            >
                <div className="flex flex-col gap-2">
                    {surfaces.map((surface, index) => (
                        <SortableSurfaceItem
                            key={surface.id}
                            surface={surface}
                            index={index}
                            constructions={constructions}
                            onEdit={onEdit}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
