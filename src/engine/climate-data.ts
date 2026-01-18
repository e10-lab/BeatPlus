import { ClimateData } from "./types";

// Seoul Climate Data (Approximate representative year)
// Te: Mean monthly external temperature (°C)
// Is_Horiz: Global Solar Irradiance on horizontal surface (Monthly Sum in kWh/m²)
const SEOUL_CLIMATE: ClimateData = {
    name: "Seoul",
    monthly: [
        { month: 1, Te: -2.4, Is_Horiz: 65 },  // Jan
        { month: 2, Te: 0.4, Is_Horiz: 90 },   // Feb
        { month: 3, Te: 5.7, Is_Horiz: 125 },  // Mar
        { month: 4, Te: 12.5, Is_Horiz: 155 }, // Apr
        { month: 5, Te: 17.8, Is_Horiz: 170 }, // May
        { month: 6, Te: 22.2, Is_Horiz: 165 }, // Jun
        { month: 7, Te: 24.9, Is_Horiz: 150 }, // Jul
        { month: 8, Te: 25.7, Is_Horiz: 155 }, // Aug
        { month: 9, Te: 21.2, Is_Horiz: 135 }, // Sep
        { month: 10, Te: 14.8, Is_Horiz: 115 }, // Oct
        { month: 11, Te: 7.2, Is_Horiz: 75 },  // Nov
        { month: 12, Te: 0.4, Is_Horiz: 60 }   // Dec
    ]
};

export const getClimateData = (region: string = "Seoul"): ClimateData => {
    // For now, return Seoul data regardless of input region
    return SEOUL_CLIMATE;
};
