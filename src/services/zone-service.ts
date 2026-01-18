import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Zone } from "@/types/project";

const PROJECTS_COLLECTION = "projects";
const ZONES_COLLECTION = "zones";

export const createZone = async (projectId: string, zoneData: Omit<Zone, "id" | "projectId">) => {
    const zonesRef = collection(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION);
    const docRef = await addDoc(zonesRef, {
        ...zoneData,
        projectId,
    });
    return docRef.id;
};

export const getZones = async (projectId: string): Promise<Zone[]> => {
    const zonesRef = collection(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION);
    const q = query(zonesRef, orderBy("name")); // Sort by name by default
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Zone[];
};

export const updateZone = async (projectId: string, zoneId: string, zoneData: Partial<Zone>) => {
    const zoneRef = doc(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId);
    await updateDoc(zoneRef, zoneData);
};

export const deleteZone = async (projectId: string, zoneId: string) => {
    const zoneRef = doc(db, PROJECTS_COLLECTION, projectId, ZONES_COLLECTION, zoneId);
    await deleteDoc(zoneRef);
};
