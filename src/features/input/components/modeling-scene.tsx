"use client";

import React, { useRef, useState, useEffect } from "react";
import { Grid, GizmoHelper, GizmoViewport, Html, Center } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getZones } from "@/services/zone-service";
import { Zone } from "@/types/project";

interface ModelingSceneProps {
    projectId: string;
    selectedZoneId: string | null;
    onSelectZone: (id: string | null) => void;
}

export function ModelingScene({ projectId, selectedZoneId, onSelectZone }: ModelingSceneProps) {
    const [zones, setZones] = useState<Zone[]>([]);

    useEffect(() => {
        async function fetchZones() {
            try {
                const data = await getZones(projectId);
                setZones(data);
            } catch (error) {
                console.error("Failed to fetch zones for 3D view:", error);
            }
        }
        fetchZones();
    }, [projectId]);

    return (
        <>
            <color attach="background" args={["#f8fafc"]} />

            {/* SketchUp style Grid */}
            <Grid
                infiniteGrid
                fadeDistance={100}
                fadeStrength={5}
                cellSize={1}
                sectionSize={5}
                sectionColor="#cbd5e1"
                cellColor="#94a3b8"
                position={[0, -0.01, 0]}
            />

            {/* Axis Helper (Gizmo) */}
            <GizmoHelper alignment="bottom-right" margin={[100, 100]}>
                <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="black" />
            </GizmoHelper>

            {/* Render Zones as Boxes */}
            {zones.map((zone: Zone, index: number) => (
                <ZoneBox
                    key={zone.id || index}
                    index={index}
                    name={zone.name}
                    // Place boxes manually, spreading them along X axis
                    position={[index * 5 - (zones.length * 2.5) + 2.5, 1.5, 0]}
                    zone={zone}
                    selected={selectedZoneId === zone.id}
                    onSelect={() => onSelectZone(zone.id || null)}
                />
            ))}

            {!zones.length && (
                <mesh position={[0, 0.5, 0]}>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="#3b82f6" />
                </mesh>
            )}

            {/* Background Plane to catch clicks for deselecting */}
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -0.01, 0]}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelectZone(null);
                }}
                visible={false}
            >
                <planeGeometry args={[100, 100]} />
            </mesh>
        </>
    );
}

function ZoneBox({ position, name, index, zone, selected, onSelect }: {
    position: [number, number, number],
    name: string,
    index: number,
    zone: Zone,
    selected: boolean,
    onSelect: () => void
}) {
    const [hovered, setHover] = useState(false);
    const meshRef = useRef<THREE.Mesh>(null!);

    // Simple animation on hover/selection
    useFrame((state, delta) => {
        const targetScale = (hovered || selected) ? 1.02 : 1;
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    });

    const color = selected ? "#3b82f6" : hovered ? "#60a5fa" : "#cbd5e1";
    const edgeColor = selected ? "#1d4ed8" : "#475569";

    return (
        <group position={position}>
            <mesh
                ref={meshRef}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHover(true);
                }}
                onPointerOut={() => setHover(false)}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                }}
            >
                <boxGeometry args={[4, 3, 4]} />
                <meshStandardMaterial
                    color={color}
                    transparent
                    opacity={0.6}
                />
                {/* SketchUp style edges */}
                <lineSegments>
                    <edgesGeometry args={[new THREE.BoxGeometry(4, 3, 4)]} />
                    <lineBasicMaterial color={edgeColor} linewidth={selected ? 3 : 1} />
                </lineSegments>
            </mesh>

            {/* Label for zone */}
            <Html position={[0, 1.8, 0]} center distanceFactor={15}>
                <div className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap pointer-events-none select-none transition-all duration-200 ${selected ? 'bg-primary text-white font-bold scale-110' : 'bg-white/90 text-slate-700 shadow-sm border border-slate-200'}`}>
                    {name || `Zone ${index + 1}`}
                </div>
            </Html>
        </group>
    );
}
