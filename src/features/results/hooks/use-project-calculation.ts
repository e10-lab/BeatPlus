"use client";

import { useCallback } from "react";
import { useCalculation } from "@/providers/calculation-provider";
import { getProject } from "@/services/project-service";
import { getZones } from "@/services/zone-service";
import { getSurfaces } from "@/services/surface-service";
import { getConstructions } from "@/services/construction-service";
import { loadClimateData, getClimateData } from "@/engine/climate-data";
import { calculateEnergyDemand } from "@/engine/calculator";
import { ZoneInput } from "@/engine/types";
import { Zone } from "@/types/project";

export function useProjectCalculation() {
    const {
        setResults,
        setWeatherData,
        setIsCalculating,
        setError
    } = useCalculation();

    const runCalculation = useCallback(async (projectId: string) => {
        setIsCalculating(true);
        setError(null);
        try {
            // 1. Fetch Project for Weather Station
            const project = await getProject(projectId);

            // 2. Fetch Zones & Constructions
            const [allZones, fetchedConstructions] = await Promise.all([
                getZones(projectId),
                getConstructions(projectId)
            ]);

            // Deduplicate zones by id just in case
            const uniqueZones = Array.from(new Map(allZones.map(z => [z.id, z])).values());

            // 3. Fetch Surfaces for each Zone and build ZoneInput
            const zoneInputs: ZoneInput[] = await Promise.all(
                uniqueZones.map(async (zone: Zone) => {
                    const surfaces = await getSurfaces(projectId, zone.id!);
                    return {
                        ...zone,
                        projectId: projectId,
                        surfaces: surfaces
                    } as ZoneInput;
                })
            );

            // 4. Load Weather Data
            let loadedWeatherData;
            if (project?.weatherStationId) {
                try {
                    loadedWeatherData = await loadClimateData(project.weatherStationId);
                } catch (e) {
                    console.warn("Failed to load weather data, using default", e);
                }
            }

            if (!loadedWeatherData) {
                loadedWeatherData = getClimateData();
            }
            setWeatherData(loadedWeatherData);

            // 5. Run Calculation (Monthly Method)
            const calcResults = calculateEnergyDemand(
                zoneInputs,
                loadedWeatherData,
                project?.mainStructure,
                project?.ventilationConfig,
                project?.ventilationUnits,
                project?.automationConfig,
                project?.systems,
                fetchedConstructions,
                "monthly"
            );

            setResults(calcResults);
        } catch (err: any) {
            console.error("Calculation failed:", err);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsCalculating(false);
        }
    }, [setResults, setWeatherData, setIsCalculating, setError]);

    return { runCalculation };
}
