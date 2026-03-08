"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { CalculationResults, ClimateData } from "@/engine/types";

interface CalculationContextType {
    results: CalculationResults | null;
    weatherData: ClimateData | null;
    isCalculating: boolean;
    error: Error | null;
    refreshTrigger: number;
    setResults: (results: CalculationResults | null) => void;
    setWeatherData: (data: ClimateData | null) => void;
    setIsCalculating: (isCalculating: boolean) => void;
    setError: (error: Error | null) => void;
    triggerRefresh: () => void;
}

const CalculationContext = createContext<CalculationContextType | undefined>(undefined);

export function CalculationProvider({ children }: { children: ReactNode }) {
    const [results, setResults] = useState<CalculationResults | null>(null);
    const [weatherData, setWeatherData] = useState<ClimateData | null>(null);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

    const triggerRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <CalculationContext.Provider value={{ 
            results, 
            weatherData, 
            isCalculating, 
            error, 
            refreshTrigger,
            setResults, 
            setWeatherData,
            setIsCalculating,
            setError,
            triggerRefresh
        }}>
            {children}
        </CalculationContext.Provider>
    );
}

export function useCalculation() {
    const context = useContext(CalculationContext);
    if (context === undefined) {
        throw new Error("useCalculation must be used within a CalculationProvider");
    }
    return context;
}
