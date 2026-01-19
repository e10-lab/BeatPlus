"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { Construction } from "@/types/project";
import { ConstructionForm } from "./construction-form";

import { createConstruction, updateConstruction, deleteConstruction } from "@/services/construction-service";

interface ConstructionManagerProps {
    constructions: Construction[];
    projectId: string;
    onUpdate: () => void;
}

export function ConstructionManager({ constructions, projectId, onUpdate }: ConstructionManagerProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleSave = async (construction: Construction) => {
        try {
            if (editingId) {
                await updateConstruction(projectId, editingId, construction);
            } else {
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

    const handleDelete = async (id: string) => {
        if (confirm("이 구조체를 삭제하시겠습니까? (Are you sure you want to delete this construction?)")) {
            try {
                await deleteConstruction(projectId, id);
                onUpdate(); // Trigger refresh in parent
            } catch (error) {
                console.error("Failed to delete construction:", error);
                alert("삭제 중 오류가 발생했습니다.");
            }
        }
    };

    if (isEditing) {
        const initialData = editingId ? constructions.find(c => c.id === editingId) : undefined;
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
    // ... rest of the component (render logic remains mostly same)
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layers className="w-5 h-5" /> 구조체 목록 (Constructions)
                </h3>
                <Button onClick={() => { setEditingId(null); setIsEditing(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> 새 구조체 추가 (New Construction)
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {constructions.map(c => (
                    <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-medium flex justify-between">
                                {c.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground pb-3">
                            <div className="flex justify-between">
                                <span>열관류율 (U-Value):</span>
                                <span className="font-mono font-bold text-foreground">{c.uValue}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>두께 (Thickness):</span>
                                <span className="font-mono">{c.totalThickness} m</span>
                            </div>
                            <div className="flex justify-between">
                                <span>레이어 (Layers):</span>
                                <span>{c.layers.length}</span>
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setIsEditing(true); }}>
                                    <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {constructions.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                        정의된 구조체가 없습니다. 새로운 구조체를 생성하세요. (No constructions defined. Create one to use in your surfaces.)
                    </div>
                )}
            </div>
        </div>
    );
}
