import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    Timestamp
} from "firebase/firestore";
import { db, sanitizeData } from "@/lib/firebase";
import { Project } from "@/types/project";

const PROJECTS_COLLECTION = "projects";

export const createProject = async (projectData: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), sanitizeData({
        ...projectData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    }));
    return docRef.id;
};

export const getProjects = async (userId: string): Promise<Project[]> => {
    const q = query(
        collection(db, PROJECTS_COLLECTION),
        where("userId", "==", userId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
    } as Project));
};

export const getProject = async (id: string): Promise<Project | null> => {
    const docRef = doc(db, PROJECTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return {
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: docSnap.data().createdAt?.toDate(),
            updatedAt: docSnap.data().updatedAt?.toDate(),
        } as Project;
    } else {
        return null;
    }
};

export const updateProject = async (id: string, updates: Partial<Project>) => {
    const docRef = doc(db, PROJECTS_COLLECTION, id);

    // Filter out undefined values to prevent Firestore errors
    const sanitizedUpdates = sanitizeData(updates);

    await updateDoc(docRef, {
        ...sanitizedUpdates,
        updatedAt: Timestamp.now(),
    });
};

export const deleteProject = async (id: string) => {
    const docRef = doc(db, PROJECTS_COLLECTION, id);
    await deleteDoc(docRef);
};

// Start of Added Code
import { getZones, updateZone } from "./zone-service";
import { getSurfaces } from "./surface-service";
import { calculateProjectStats, ProjectStats } from "@/lib/standard-values";

export const getProjectStats = async (projectId: string): Promise<ProjectStats> => {
    // 1. Fetch all zones
    const zones = await getZones(projectId);

    // 2. Fetch all surfaces for all zones
    // This could be optimized if we had a collectionGroup query or if surfaces were subcollections
    // Currently surfaces are subcollections of zones: projects/{pid}/zones/{zid}/surfaces
    // We need to iterate.
    const surfacePromises = zones.map(zone => getSurfaces(projectId, zone.id!));
    const surfacesArrays = await Promise.all(surfacePromises);
    const allSurfaces = surfacesArrays.flat();

    // 3. Calculate Stats
    return calculateProjectStats(zones, allSurfaces);
};

export const updateProjectVentilation = async (
    projectId: string,
    config: {
        type: "natural" | "mechanical";
        heatRecoveryEfficiency: number;
        n50: number;
        isMeasured?: boolean;
        hasALD?: boolean;
    }
) => {
    // Sanitize config for Firestore (undefined not allowed)
    const sanitizedConfig = {
        ...config,
        isMeasured: config.isMeasured ?? false
    };

    // 1. Update Project
    await updateProject(projectId, { ventilationConfig: sanitizedConfig });

    // 2. Update All Zones - REMOVED
    // Zones now use linkedVentilationUnitIds or fallback to Project config dynamically.
    // No need to copy values to Zone.

    // const zones = await getZones(projectId);
    // ...
};
