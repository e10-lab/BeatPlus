"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Plus, Pencil, Trash2, Layers, Sun, Wind, Mountain
} from "lucide-react";
import { Construction } from "@/types/project";
import { ConstructionForm } from "./construction-form";
import { SurfaceIcon } from "@/components/ui/icons/surface-icon";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { createConstruction, updateConstruction, deleteConstruction, reorderConstructions } from "@/services/construction-service";
import { calculateSHGC } from "@/lib/shgc-calculator";

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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ConstructionManagerProps {
    constructions: Construction[];
    projectId: string;
    onUpdate: () => void;
}

const getCategoryLabel = (type: string) => {
    if (type.startsWith("wall")) return "벽체 (Wall)";
    if (type.startsWith("roof")) return "지붕 (Roof)";
    if (type.startsWith("floor")) return "바닥 (Floor)";
    if (type === "window") return "창호 (Window)";
    if (type === "door") return "문 (Door)";
    return "기타";
};

// Helper to get Exposure Icon
const getExposureIcon = (type: string) => {
    if (type === "window" || type === "door") return <Sun className="w-4 h-4 text-amber-500" />; // Always Direct

    if (type.includes("exterior") || type === "roof_exterior") return <Sun className="w-4 h-4 text-amber-500" />;
    if (type.includes("interior")) return <Wind className="w-4 h-4 text-blue-300" />; // Indirect/Air
    if (type.includes("ground")) return <Mountain className="w-4 h-4 text-stone-600" />;

    return null;
};

const getExposureLabel = (type: string) => {
    if (type === "window" || type === "door") return "직접 (Direct)";
    if (type.includes("exterior") || type === "roof_exterior") return "직접 (Direct)";
    if (type.includes("interior")) return "간접 (Indirect)";
    if (type.includes("ground")) return "지면 (Ground)";
    return "";
};

// Sortable Item Component
interface SortableConstructionCardProps {
    c: Construction;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
}

function SortableConstructionCard({ c, onEdit, onDelete }: SortableConstructionCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: c.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onEdit(c.id)}
            className={`relative flex items-center justify-between p-3 border rounded-lg bg-card hover:shadow-sm transition-all group cursor-pointer ${isDragging ? "ring-2 ring-primary z-50" : ""}`}
        >
            <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1.5 p-2 bg-muted rounded-md text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors min-w-[40px]">
                    <SurfaceIcon type={c.type} className="w-5 h-5" />
                    {/* Exposure Icon as sub-icon */}
                    {getExposureIcon(c.type) && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="p-0.5 rounded-full bg-background/50 cursor-help" onClick={(e) => e.stopPropagation()}>
                                        {getExposureIcon(c.type)}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{getExposureLabel(c.type)}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <div>
                    <div className="font-semibold flex items-center gap-2 mb-1">
                        {c.name}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1 font-mono text-foreground">
                            <span className="text-muted-foreground text-xs">U:</span> {c.uValue.toFixed(3)}
                        </div>

                        {/* SHGC for Window/Door */}
                        {(c.type === 'window' || c.type === 'door') && (
                            <div className="flex items-center gap-1 text-blue-600 font-medium text-xs">
                                <span>SHGC:</span>
                                <span>
                                    {c.shgc !== undefined ? c.shgc : calculateSHGC(c.layers)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                {/* Actions */}
                <Button variant="ghost" size="icon" className="h-8 w-8 bg-red-50 text-destructive hover:bg-red-100 hover:text-red-600" onClick={() => onDelete(c.id)}>
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

export function ConstructionManager({ constructions, projectId, onUpdate }: ConstructionManagerProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [items, setItems] = useState<Construction[]>(constructions);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

    // Sync items when props change (e.g. initial load or refetch)
    useEffect(() => {
        setItems(constructions);
    }, [constructions]);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px movement before drag starts (prevents blocking clicks)
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                const newItems = arrayMove(items, oldIndex, newIndex);

                // Optimistic UI update done, now save to DB
                // Call reorderConstructions (async) - we don't wait for it
                const orderedIds = newItems.map(item => item.id);
                reorderConstructions(projectId, orderedIds).catch(err => {
                    console.error("Failed to reorder:", err);
                    onUpdate(); // Revert on error
                });

                return newItems;
            });
        }
    };

    const handleSave = async (construction: Construction) => {
        try {
            if (editingId) {
                await updateConstruction(projectId, editingId, construction);
            } else {
                // Determine order index for new item? Service handles default append or we can.
                // For now, let service add it, refetch will show it at bottom.
                await createConstruction(projectId, construction);
            }
            setIsEditing(false);
            setEditingId(null);
            onUpdate(); // Trigger refresh in parent
        } catch (error) {
            console.error("Failed to save construction:", error);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteClick = (id: string) => {
        const item = items.find(c => c.id === id);
        if (item) {
            setItemToDelete({ id, name: item.name });
            setDeleteConfirmOpen(true);
        }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteConstruction(projectId, itemToDelete.id);
            setDeleteConfirmOpen(false);
            setItemToDelete(null);
            onUpdate(); // Trigger refresh in parent
        } catch (error) {
            console.error("Failed to delete construction:", error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    if (isEditing) {
        const initialData = editingId ? items.find(c => c.id === editingId) : undefined;
        return (
            <div className="max-w-5xl mx-auto">
                <ConstructionForm
                    projectId={projectId}
                    initialData={initialData}
                    onSave={handleSave}
                    onCancel={() => { setIsEditing(false); setEditingId(null); }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layers className="w-5 h-5" /> 외피 유형 목록 (Assemblies)
                </h3>
                <Button onClick={() => { setEditingId(null); setIsEditing(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> 새 외피 유형 추가 (New Assembly)
                </Button>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={items.map(c => c.id)}
                    strategy={rectSortingStrategy}
                >
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {items.map(c => (
                            <SortableConstructionCard
                                key={c.id}
                                c={c}
                                onEdit={(id) => { setEditingId(id); setIsEditing(true); }}
                                onDelete={handleDeleteClick}
                            />
                        ))}
                        {items.length === 0 && (
                            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                                정의된 외피 유형이 없습니다. 새로운 외피 유형을 생성하세요. (No assemblies defined. Create one to use in your surfaces.)
                            </div>
                        )}
                    </div>
                </SortableContext>
            </DndContext>

            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>외피 유형 삭제 확인</DialogTitle>
                        <DialogDescription>
                            정말로 &apos;{itemToDelete?.name}&apos; 외피 유형을 삭제하시겠습니까?
                            현재 이 유형을 사용 중인 모든 표면에서의 연결 정보가 손실될 수 있습니다.
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
        </div>
    );
}
