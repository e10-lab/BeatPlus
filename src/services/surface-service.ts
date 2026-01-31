import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    writeBatch
} from "firebase/firestore";
import { db, sanitizeData } from "@/lib/firebase";
import { Surface } from "@/types/project";

const PROJECTS_COLLECTION = "projects";
const ZONES_COLLECTION = "zones";
const SURFACES_COLLECTION = "surfaces";

// Helper to get reference to surfaces collection: projects/{projectId}/zones/{zoneId}/surfaces
const getSurfacesCollectionRef = (projectId: string, zoneId: string) => {
    return collection(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId, SURFACES_COLLECTION);
};

export const createSurface = async (projectId: string, zoneId: string, surfaceData: Omit<Surface, "id" | "zoneId">) => {
    const surfacesRef = getSurfacesCollectionRef(projectId, zoneId);
    const docRef = await addDoc(surfacesRef, sanitizeData({
        ...surfaceData,
        zoneId,
    }));
    return docRef.id;
};

export const getSurfaces = async (projectId: string, zoneId: string): Promise<Surface[]> => {
    const surfacesRef = getSurfacesCollectionRef(projectId, zoneId);
    const q = query(surfacesRef, orderBy("name")); // Sort by name by default
    const querySnapshot = await getDocs(q);

    const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Surface[];

    // Client-side sort: orderIndex asc, then name asc
    return data.sort((a, b) => {
        const orderA = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });
};

export const updateSurface = async (projectId: string, zoneId: string, surfaceId: string, surfaceData: Partial<Surface>) => {
    const surfaceRef = doc(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId, SURFACES_COLLECTION, surfaceId);
    await updateDoc(surfaceRef, sanitizeData(surfaceData));
};

export const deleteSurface = async (projectId: string, zoneId: string, surfaceId: string) => {
    const surfaceRef = doc(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId, SURFACES_COLLECTION, surfaceId);
    await deleteDoc(surfaceRef);
};

export const reorderSurfaces = async (projectId: string, zoneId: string, orderedIds: string[]) => {
    const batch = writeBatch(db);

    orderedIds.forEach((id, index) => {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId, SURFACES_COLLECTION, id);
        batch.update(docRef, {
            orderIndex: index
        });
    });

    await batch.commit();
};
