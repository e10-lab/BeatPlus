import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    setDoc,
    writeBatch
} from "firebase/firestore";
import { db, sanitizeData } from "@/lib/firebase";
import { Construction, Surface } from "@/types/project";
import { getZones } from "./zone-service";
import { getSurfaces, updateSurface, deleteSurface } from "./surface-service";

const PROJECTS_COLLECTION = "projects";
const CONSTRUCTIONS_COLLECTION = "constructions";



export const createConstruction = async (projectId: string, constructionData: Omit<Construction, "id" | "projectId"> & { id?: string }) => {
    const constructionsRef = collection(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION);

    const docRef = await addDoc(constructionsRef, sanitizeData({
        ...constructionData,
        projectId,
        createdAt: new Date(),
        updatedAt: new Date()
    }));
    return docRef.id;
};

// Overload for manual ID sets usually not needed unless syncing.

export const getConstructions = async (projectId: string): Promise<Construction[]> => {
    const constructionsRef = collection(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION);
    const q = query(constructionsRef, orderBy("name"));
    const querySnapshot = await getDocs(q);

    const data = querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id, // MUST be last to override any 'id' field from doc.data()
    })) as Construction[];

    // Client-side sort: orderIndex asc, then name asc
    return data.sort((a, b) => {
        const orderA = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });
};

export const updateConstruction = async (projectId: string, constructionId: string, constructionData: Partial<Construction>) => {
    const constructionRef = doc(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION, constructionId);

    // Strip client-side IDs that shouldn't be stored as document fields
    // (Firestore uses the document path for ID, not an 'id' field in the data)
    const { id: _stripId, projectId: _stripProjId, ...cleanData } = constructionData as any;

    const dataToWrite = sanitizeData({
        ...cleanData,
        updatedAt: new Date()
    });

    // Use setDoc with merge: true to handle cases where the document might be missing (upsert)
    await setDoc(constructionRef, dataToWrite, { merge: true });

    // Cascade update: If key thermal properties changed, update linked surfaces
    if (constructionData.uValue !== undefined || constructionData.shgc !== undefined || constructionData.absorptionCoefficient !== undefined) {
        const zones = await getZones(projectId);
        for (const zone of zones) {
            if (!zone.id) continue;
            const surfaces = await getSurfaces(projectId, zone.id);
            const linkedSurfaces = surfaces.filter(s => s.constructionId === constructionId);

            if (linkedSurfaces.length > 0) {
                const updates: Partial<Surface> = {};
                // Only include defined values to avoid overwriting with undefined if not passed (though typically update passes full obj)
                // Actually, if constructionData has it (even if null/undefined explicitly?), we should sync?
                // For partial updates, we might only have uValue.
                // We should assume if it's in constructionData, it's the new truth.

                if (constructionData.uValue !== undefined) updates.uValue = constructionData.uValue;
                if (constructionData.shgc !== undefined) updates.shgc = constructionData.shgc;
                if (constructionData.absorptionCoefficient !== undefined) updates.absorptionCoefficient = constructionData.absorptionCoefficient;

                await Promise.all(linkedSurfaces.map(surface =>
                    updateSurface(projectId, zone.id!, surface.id!, updates)
                ));
            }
        }
    }
};

export const deleteConstruction = async (projectId: string, constructionId: string) => {
    const constructionRef = doc(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION, constructionId);
    await deleteDoc(constructionRef);

    // Cascade delete: Remove reference from surfaces
    const zones = await getZones(projectId);
    for (const zone of zones) {
        if (!zone.id) continue;
        const surfaces = await getSurfaces(projectId, zone.id);
        const linkedSurfaces = surfaces.filter(s => s.constructionId === constructionId);

        await Promise.all(linkedSurfaces.map(surface =>
            deleteSurface(projectId, zone.id!, surface.id!)
        ));
    }
};

export const reorderConstructions = async (projectId: string, orderedIds: string[]) => {
    const batch = writeBatch(db);

    orderedIds.forEach((id, index) => {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId, CONSTRUCTIONS_COLLECTION, id);
        batch.update(docRef, {
            orderIndex: index,
            updatedAt: new Date()
        });
    });

    await batch.commit();
};
