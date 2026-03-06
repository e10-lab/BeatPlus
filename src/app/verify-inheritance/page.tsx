"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DIN_18599_PROFILES } from '@/lib/din-18599-profiles';
import { calculateEnergyDemand } from '@/engine/calculator';
import { ZoneInput } from '@/engine/types';
import { Construction } from '@/types/project';
import { BuildingAutomationConfig } from '@/types/project';

export default function VerifyParentZoneInheritance() {
    const [result, setResult] = useState<any>(null);
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) => setLog(prev => [...prev, msg]);

    const runTest = () => {
        addLog("Starting Parent Zone Inheritance Verification...");

        // 1. Create Mock Zones
        // Parent Zone: Office (Profile 1) - Default 07:00-18:00
        const parentZone: ZoneInput = {
            id: "parent-zone-1",
            name: "Office (Parent)",
            usageType: "1_office", // Profile 1
            area: 100,
            height: 3,
            volume: 300,
            temperatureSetpoints: { heating: 20, cooling: 26 },
            surfaces: [],
            projectId: "test-project"
        };

        // Child Zone: WC (Profile 16) - Should inherit
        const childZone: ZoneInput = {
            id: "child-zone-1",
            name: "WC (Child)",
            usageType: "16_wc_sanitary", // Profile 16
            area: 10,
            height: 3,
            volume: 30,
            temperatureSetpoints: { heating: 20, cooling: 26 },
            surfaces: [],
            linkedParentZoneId: "parent-zone-1", // LINKED!
            projectId: "test-project"
        };

        // Independent Zone: WC (Profile 16) - No Parent (Fallback)
        const independentZone: ZoneInput = {
            id: "indep-zone-1",
            name: "WC (Independent)",
            usageType: "16_wc_sanitary",
            area: 10,
            height: 3,
            volume: 30,
            temperatureSetpoints: { heating: 20, cooling: 26 },
            surfaces: [],
            projectId: "test-project"
            // No linkedParentZoneId
        };

        const zones = [parentZone, childZone, independentZone];

        // Mock Configs - Use minimal valid type assertions
        const ventilationConfig = {
            type: "natural",
            n50: 2,
            heatRecoveryEfficiency: 0
        } as any;

        const automationConfig = {
            class: "C"
        } as any;

        // Mock Constructions (Minimal)
        const mockConstructions: Construction[] = [];


        const profile1 = DIN_18599_PROFILES["1_office"];
        const profile16 = DIN_18599_PROFILES["16_wc_sanitary"];

        addLog(`Parent Profile (Office): Days=${profile1.annualUsageDays}, Hours=${profile1.dailyUsageHours}`);
        addLog(`Child Profile (WC) Default: Days=${profile16.annualUsageDays}, Hours=${profile16.dailyUsageHours}`);

        try {
            // Use calculateEnergyDemand instead of calculateProjectEnergyBalance
            const results = calculateEnergyDemand(
                zones,
                undefined, // weatherData
                undefined, // mainStructure
                ventilationConfig,
                undefined, // ventilationUnits
                automationConfig,
                [], // systems
                mockConstructions,
                undefined // analysisMethod
            );

            addLog("Calculation completed successfully.");
            setResult(results);

            // Verify Inheritance
            // We need ZONE level results to verify inheritance.

            const parentZoneResult = results.zones.find((z: any) => z.zoneId === "parent-zone-1");
            const childZoneResult = results.zones.find((z: any) => z.zoneId === "child-zone-1");
            const independentZoneResult = results.zones.find((z: any) => z.zoneId === "indep-zone-1");

            if (parentZoneResult && childZoneResult) {
                // Check a specific month, e.g., Jan
                const pJan = parentZoneResult.monthly[0];
                const cJan = childZoneResult.monthly[0];
                const iJan = independentZoneResult ? independentZoneResult.monthly[0] : null;

                addLog(`[VERIFICATION] Parent Zone (Office) results found.`);
                // Note: usage_days/hours might not be directly in MonthlyResult unless we added them. 
                // We added 'lighting_usage_hours', 'dhw_usage_days'.

                addLog(`[PARENT] Lighting Hours=${(pJan.lighting_usage_hours || 0).toFixed(1)}, DHW Days=${(pJan.dhw_usage_days || 0).toFixed(1)}`);
                addLog(`[CHILD]  Lighting Hours=${(cJan.lighting_usage_hours || 0).toFixed(1)}, DHW Days=${(cJan.dhw_usage_days || 0).toFixed(1)}`);

                if (iJan) {
                    addLog(`[INDEP]  Lighting Hours=${(iJan.lighting_usage_hours || 0).toFixed(1)}, DHW Days=${(iJan.dhw_usage_days || 0).toFixed(1)}`);
                } else {
                    addLog(`[INDEP]  No independent result found.`);
                }

                // EXPECTATION: Child should match Parent, Independent should match Profile 16 default.
            } else {
                addLog(`[ERROR]  Could not find zone results for parent or child.`);
            }

        } catch (e: any) {
            addLog(`Error: ${e.message}`);
            console.error(e);
        }
    };

    return (
        <Card className="w-full max-w-4xl mx-auto my-8">
            <CardHeader>
                <CardTitle>Parent Zone Inheritance Verification</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <Button onClick={runTest}>Run Verification Test</Button>

                    <div className="bg-slate-950 text-slate-50 p-4 rounded-md font-mono text-sm min-h-[200px] whitespace-pre-wrap">
                        {log.map((l, i) => <div key={i}>{l}</div>)}
                    </div>

                    {result && (
                        <div className="mt-4">
                            <h3 className="font-bold">Results Summary:</h3>
                            <pre className="text-xs overflow-auto max-h-[300px]">
                                {JSON.stringify(result.yearly, null, 2)}
                            </pre>
                            <h3 className="font-bold mt-4">Zone Monthly Details (Check Inheritance):</h3>
                            <pre className="text-xs overflow-auto max-h-[300px]">
                                {JSON.stringify(result.monthly, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
