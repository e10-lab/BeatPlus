"use client";

import { useMemo } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    Position,
    MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BuildingSystem } from "@/types/system";
import { Zone } from "@/types/project";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface SystemGraphViewProps {
    systems: BuildingSystem[];
    zones: Zone[];
}

export function SystemGraphView({ systems, zones }: SystemGraphViewProps) {
    // 1. Calculate Layout
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    const SYSTEM_X = 50;
    const ZONE_X = 450;
    const START_Y = 50;
    const ITEM_HEIGHT = 80;

    // Create Zone Nodes (Right Column)
    zones.forEach((zone, index) => {
        initialNodes.push({
            id: zone.id || `zone-${index}`,
            position: { x: ZONE_X, y: START_Y + (index * ITEM_HEIGHT) },
            data: { label: zone.name, type: 'zone' },
            type: 'default', // Using default node for simplicity for now, can customize later
            style: {
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                width: 200,
                padding: '10px',
                fontWeight: 'bold',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            },
            sourcePosition: Position.Left,
            targetPosition: Position.Left, // Zones are targets
        });
    });

    // Create System Nodes (Left Column)
    systems.forEach((sys, index) => {
        let color = '#e2e8f0';
        let borderColor = '#94a3b8';

        switch (sys.type) {
            case 'HEATING':
                color = '#fef2f2'; // Red-ish
                borderColor = '#fca5a5';
                break;
            case 'COOLING':
                color = '#f0f9ff'; // Blue-ish
                borderColor = '#7dd3fc';
                break;
            case 'DHW':
                color = '#eff6ff'; // Blue-ish
                borderColor = '#93c5fd';
                break;
            case 'PV':
                color = '#fefce8'; // Yellow-ish
                borderColor = '#fde047';
                break;
        }

        const nodeId = sys.id;

        initialNodes.push({
            id: nodeId,
            position: { x: SYSTEM_X, y: START_Y + (index * ITEM_HEIGHT) },
            data: { label: sys.name, type: sys.type },
            type: 'input', // Systems are sources
            style: {
                background: color,
                border: `1px solid ${borderColor}`,
                borderRadius: '8px',
                width: 250,
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
            },
            sourcePosition: Position.Right,
        });

        // Edges
        if (sys.isShared) {
            // Connect to ALL zones if shared, or maybe a "Global" node? 
            // For now, let's connect to all zones to visualize the impact.
            zones.forEach(zone => {
                initialEdges.push({
                    id: `e-${sys.id}-${zone.id}`,
                    source: sys.id,
                    target: zone.id!,
                    animated: true,
                    style: { stroke: borderColor },
                    markerEnd: { type: MarkerType.ArrowClosed, color: borderColor },
                });
            });
        } else if (sys.linkedZoneIds && sys.linkedZoneIds.length > 0) {
            sys.linkedZoneIds.forEach(zId => {
                initialEdges.push({
                    id: `e-${sys.id}-${zId}`,
                    source: sys.id,
                    target: zId,
                    animated: true,
                    style: { stroke: borderColor },
                    markerEnd: { type: MarkerType.ArrowClosed, color: borderColor },
                });
            });
        }
    });

    // Memoize
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, , onEdgesChange] = useEdgesState(initialEdges);

    return (
        <div style={{ height: '600px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
            >
                <Background />
                <Controls />
                <MiniMap nodeStrokeWidth={3} zoomable pannable />
            </ReactFlow>
        </div>
    );
}
