"use client";

import { useState } from "react";
import { VentilationUnit } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { updateProject } from "@/services/project-service";

interface VentilationUnitManagerProps {
    projectId: string;
    units: VentilationUnit[];
    onUpdate: () => void;
}

export function VentilationUnitManager({ projectId, units, onUpdate }: VentilationUnitManagerProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<VentilationUnit>({
        id: "",
        name: "",
        type: "balanced",
        heatRecoveryEfficiency: 0,
        supplyFanPower: 0,
        supplyFlowRate: 0,
        exhaustFlowRate: 0,
        category: "erv" // Default to ERV
    });

    const handleAddNew = () => {
        setFormData({
            id: uuidv4(),
            name: "새 공조기",
            type: "balanced",
            heatRecoveryEfficiency: 70,
            supplyFanPower: 0,
            supplyFlowRate: 0,
            exhaustFlowRate: 0,
            category: "erv"
        });
        setIsEditing(true);
        setEditingId(null);
    };

    // 신규 생성 또는 마이그레이션을 위한 기본 카테고리 결정함수
    const getInitialCategory = (unit: VentilationUnit): "fan" | "erv" | "ahu" => {
        if (unit.category) return unit.category;
        // 마이그레이션 로직: 이름 등을 기반으로 추정
        if (unit.type === 'balanced') {
            return unit.name.toLowerCase().includes('ahu') || unit.name.includes('공조기') ? 'ahu' : 'erv';
        }
        return 'fan';
    };

    const handleEdit = (unit: VentilationUnit) => {
        setFormData({ ...unit, category: getInitialCategory(unit) });
        setIsEditing(true);
        setEditingId(unit.id);
    };

    // ... existing handleDelete ...
    const handleDelete = async (id: string) => {
        if (!confirm("이 공조기를 삭제하시겠습니까?")) return;

        const updatedUnits = units.filter(u => u.id !== id);
        try {
            await updateProject(projectId, { ventilationUnits: updatedUnits });
            onUpdate();
        } catch (error) {
            console.error("Failed to delete unit:", error);
        }
    };

    // ... existing handleSave ...
    const handleSave = async () => {
        if (!formData.name) return alert("이름을 입력해주세요.");

        let updatedUnits = [...units];
        if (editingId) {
            // 기존 항목 수정
            updatedUnits = updatedUnits.map(u => u.id === editingId ? formData : u);
        } else {
            // 새 항목 추가
            updatedUnits.push(formData);
        }

        try {
            await updateProject(projectId, { ventilationUnits: updatedUnits });
            setIsEditing(false);
            setEditingId(null);
            onUpdate();
        } catch (error) {
            console.error("Failed to save unit:", error);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditingId(null);
    };

    // 카테고리 변경 시 필드 초기화 로직
    const handleCategoryChange = (cat: "fan" | "erv" | "ahu") => {
        const newData = { ...formData, category: cat };
        if (cat === "fan") {
            newData.heatRecoveryEfficiency = 0;
            newData.type = "exhaust"; // 팬 기본값: 배기 전용
        } else if (cat === "erv") {
            newData.type = "balanced";
            newData.heatRecoveryEfficiency = 70; // ERV 기본값: 고효율
        } else if (cat === "ahu") {
            newData.type = "balanced"; // AHU 기본값: 급/배기
            newData.heatRecoveryEfficiency = 70;
        }
        setFormData(newData);
    };

    if (isEditing) {
        return (
            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle>{editingId ? "공조기 수정" : "새 공조기 추가"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>장비명</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="예: AHU-1"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>장비 분류 (Category)</Label>
                        <Select
                            value={formData.category || "erv"}
                            onValueChange={(val: "fan" | "erv" | "ahu") => handleCategoryChange(val)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fan">급/배기팬 (Fan)</SelectItem>
                                <SelectItem value="erv">폐열회수형 환기장치 (ERV/HRV)</SelectItem>
                                <SelectItem value="ahu">공조기 (AHU)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(formData.category === 'fan') && (
                            <div className="space-y-2">
                                <Label>팬 기능 (Function)</Label>
                                <Select
                                    value={formData.type === 'balanced' ? 'exhaust' : formData.type} // 팬은 보통 balanced가 아니므로 안전하게 처리
                                    onValueChange={(val: "exhaust" | "supply") =>
                                        setFormData({ ...formData, type: val })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="exhaust">배기 전용 (Exhaust Fan)</SelectItem>
                                        <SelectItem value="supply">급기 전용 (Supply Fan)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {(formData.category === 'ahu') && (
                            <div className="space-y-2">
                                <Label>공조 방식 (Type)</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(val: "balanced" | "supply") =>
                                        setFormData({ ...formData, type: val })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="balanced">급/배기 (Balanced)</SelectItem>
                                        <SelectItem value="supply">급기 전용 (Supply Only)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* ERV is always balanced, so no Type selector needed */}

                        {(formData.category !== 'fan') && (
                            <div className="space-y-2">
                                <Label>열회수 효율 [%]</Label>
                                <Input
                                    type="number"
                                    value={formData.heatRecoveryEfficiency}
                                    onChange={(e) => setFormData({ ...formData, heatRecoveryEfficiency: Number(e.target.value) })}
                                />
                            </div>
                        )}

                        {(formData.type !== 'exhaust') && (
                            <div className="space-y-2">
                                <Label>급기 풍량 [m³/h]</Label>
                                <Input
                                    type="number"
                                    value={formData.supplyFlowRate || 0}
                                    onChange={(e) => setFormData({ ...formData, supplyFlowRate: Number(e.target.value) })}
                                />
                            </div>
                        )}

                        {(formData.type !== 'supply') && (
                            <div className="space-y-2">
                                <Label>배기 풍량 [m³/h]</Label>
                                <Input
                                    type="number"
                                    value={formData.exhaustFlowRate || 0}
                                    onChange={(e) => setFormData({ ...formData, exhaustFlowRate: Number(e.target.value) })}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>SFP (공급 팬 동력) [W/(m³/h)]</Label>
                            <Input
                                type="number"
                                value={formData.supplyFanPower || 0}
                                onChange={(e) => setFormData({ ...formData, supplyFanPower: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleCancel}><X className="mr-2 h-4 w-4" /> 취소</Button>
                    <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> 저장</Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">공조 장비 목록</h3>
                <Button onClick={handleAddNew} size="sm">
                    <Plus className="mr-2 h-4 w-4" /> 장비 추가
                </Button>
            </div>

            {units.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                    등록된 공조 장비가 없습니다.
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {units.map((unit) => (
                        <Card
                            key={unit.id}
                            className="relative group cursor-pointer hover:border-primary transition-colors"
                            onClick={() => handleEdit(unit)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base">{unit.name}</CardTitle>
                                        <div className="flex gap-2">
                                            {/* Category Badge */}
                                            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-inset ring-gray-500/10">
                                                {unit.category === 'fan' ? 'FAN' : unit.category === 'ahu' ? 'AHU' : 'ERV'}
                                            </span>
                                            <CardDescription className="inline-block">
                                                {unit.type === 'balanced' ? '급/배기' :
                                                    unit.type === 'exhaust' ? '배기 전용' : '급기 전용'}
                                            </CardDescription>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-2 text-sm space-y-1">
                                {unit.category !== 'fan' && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">열회수 효율:</span>
                                        <span>{unit.heatRecoveryEfficiency}%</span>
                                    </div>
                                )}
                                {(unit.supplyFlowRate || 0) > 0 && unit.type !== 'exhaust' && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">급기량:</span>
                                        <span>{unit.supplyFlowRate} m³/h</span>
                                    </div>
                                )}
                                {(unit.exhaustFlowRate || 0) > 0 && unit.type !== 'supply' && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">배기량:</span>
                                        <span>{unit.exhaustFlowRate} m³/h</span>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="pt-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(unit.id);
                                }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
