"use client";

import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stage, Loader, Html } from "@react-three/drei";
import { ModelingScene } from "./modeling-scene";
import { Loader2 } from "lucide-react";

interface ThreeDViewProps {
    projectId: string;
}

export function ThreeDView({ projectId }: ThreeDViewProps) {
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

    return (
        <div className="relative w-full h-[600px] bg-white border rounded-lg overflow-hidden">
            <Suspense fallback={
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-50">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <div className="text-sm font-medium text-slate-500">3D 환경을 불러오고 있습니다...</div>
                </div>
            }>
                <Canvas shadows camera={{ position: [15, 15, 15], fov: 50 }}>
                    <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />

                    <ModelingScene
                        projectId={projectId}
                        selectedZoneId={selectedZoneId}
                        onSelectZone={setSelectedZoneId}
                    />

                    <ambientLight intensity={1.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                    <directionalLight position={[-5, 10, 5]} intensity={1} />
                </Canvas>
            </Suspense>

            {/* UI Overlay for controls */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 p-2 bg-white/80 backdrop-blur-sm rounded-md shadow-sm border">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">3D View Controls</div>
                <div className="text-[10px] text-slate-600">Left Click: Orbit</div>
                <div className="text-[10px] text-slate-600">Right Click: Pan</div>
                <div className="text-[10px] text-slate-600">Scroll: Zoom</div>
                {selectedZoneId && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                        <div className="text-[10px] font-semibold text-primary">Selected Zone</div>
                        <div className="text-[10px] text-slate-600 truncate max-w-[150px]">{selectedZoneId}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
