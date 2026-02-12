import { Project, Construction } from "@/types/project";
import { ZoneInput, CalculationResults, ClimateData } from "./types";

export interface IEnergyCalculationStrategy {
    name: string;
    description: string;

    /**
     * Executes the energy calculation for the given zones and project data.
     */
    calculate(
        zones: ZoneInput[],
        weatherData?: ClimateData,
        projectConfig?: {
            mainStructure?: string;
            ventilationConfig?: Project['ventilationConfig'];
            ventilationUnits?: Project['ventilationUnits'];
            automationConfig?: Project['automationConfig'];
            systems?: Project['systems'];
            constructions?: Construction[];
        }
    ): CalculationResults;
}
