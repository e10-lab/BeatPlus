"use client";

import { BuildingSystem } from "@/types/system";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit2, Flame, Droplets, Snowflake, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SystemListProps {
    projectId: string;
    systems: BuildingSystem[];
    onAdd: () => void;
    onEdit: (system: BuildingSystem) => void;
    onDelete: (systemId: string) => void;
}

export function SystemList({ projectId, systems, onAdd, onEdit, onDelete }: SystemListProps) {

    const getSystemIcon = (type: string) => {
        switch (type) {
            case "DHW": return <Droplets className="h-5 w-5 text-blue-500" />;
            case "HEATING": return <Flame className="h-5 w-5 text-red-500" />;
            case "COOLING": return <Snowflake className="h-5 w-5 text-sky-400" />;
            case "LIGHTING": return <Lightbulb className="h-5 w-5 text-orange-400" />;
            default: return <Flame className="h-5 w-5" />; // Fallback
        }
    };

    const getSystemLabel = (type: string) => {
        switch (type) {
            case "DHW": return "급탕 (DHW)";
            case "HEATING": return "난방 (Heating)";
            case "COOLING": return "냉방 (Cooling)";
            case "LIGHTING": return "조명 (Lighting)";
            default: return type;
        }
    };

    const getSystemDescription = (system: BuildingSystem) => {
        if (system.type === "DHW") {
            const gen = system.generator.type === "boiler" ? "보일러" :
                system.generator.type === "heat_pump" ? "히트펌프" :
                    system.generator.type === "district" ? "지역난방" : "기타";
            return `${gen} (효율: ${system.generator.efficiency})`;
        } else if (system.type === "HEATING") {
            const gen = system.generator.type.includes("boiler") ? "보일러" :
                system.generator.type === "heat_pump" ? "히트펌프" :
                    system.generator.type === "district" ? "지역난방" : "기타";
            return `${gen} (효율: ${system.generator.efficiency})`;
        } else if (system.type === "COOLING") {
            return `냉방 장치 (효율: ${system.generator.efficiency})`;
        } else if (system.type === "LIGHTING") {
            const control = system.controlType === "manual" ? "수동" :
                system.controlType === "occupancy" ? "재실" :
                    system.controlType === "daylight" ? "주광" :
                        system.controlType === "dual" ? "복합" : "정조도";
            return `효율: ${system.lightingEfficacy} lm/W, 제어: ${control}`;
        }
        return "";
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">열원 및 설비 시스템 목록</h3>
                <Button onClick={onAdd} size="sm">
                    <Plus className="mr-2 h-4 w-4" /> 시스템 추가
                </Button>
            </div>

            {systems.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                    등록된 시스템이 없습니다.
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {systems.map((system) => (
                        <Card
                            key={system.id}
                            className="relative group cursor-pointer hover:border-primary transition-colors"
                            onClick={() => onEdit(system)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            {getSystemIcon(system.type)}
                                            <CardTitle className="text-base truncate max-w-[150px]">{system.name}</CardTitle>
                                        </div>
                                        <div className="flex gap-2">
                                            <Badge variant="secondary" className="text-xs font-normal">
                                                {getSystemLabel(system.type)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-2 text-sm space-y-1">
                                <div className="text-muted-foreground">
                                    {getSystemDescription(system)}
                                </div>
                                <div className="text-xs text-muted-foreground pt-1">
                                    {system.isShared ? "전체 존 공용" : `${(system.linkedZoneIds || []).length}개 존 연결됨`}
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2 flex justify-end gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(system.id);
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
