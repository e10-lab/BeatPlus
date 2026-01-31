import { db, sanitizeData } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { BuildingSystem } from "@/types/system";
import { Project } from "@/types/project";

const PROJECTS_COLLECTION = "projects";

export const getSystems = async (projectId: string): Promise<BuildingSystem[]> => {
    const docRef = doc(db, PROJECTS_COLLECTION, projectId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const project = docSnap.data() as Project;
        return project.systems || [];
    }
    return [];
};

export const addSystem = async (projectId: string, system: BuildingSystem) => {
    const docRef = doc(db, PROJECTS_COLLECTION, projectId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const project = docSnap.data() as Project;
        const currentSystems = project.systems || [];
        const updatedSystems = [...currentSystems, system];

        await updateDoc(docRef, sanitizeData({
            systems: updatedSystems
        }));
    }
};

export const updateSystem = async (projectId: string, system: BuildingSystem) => {
    const docRef = doc(db, PROJECTS_COLLECTION, projectId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const project = docSnap.data() as Project;
        const currentSystems = project.systems || [];
        const updatedSystems = currentSystems.map(s => s.id === system.id ? system : s);

        await updateDoc(docRef, sanitizeData({
            systems: updatedSystems
        }));
    }
};

export const deleteSystem = async (projectId: string, systemId: string) => {
    const docRef = doc(db, PROJECTS_COLLECTION, projectId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const project = docSnap.data() as Project;
        const currentSystems = project.systems || [];
        const updatedSystems = currentSystems.filter(s => s.id !== systemId);

        await updateDoc(docRef, sanitizeData({
            systems: updatedSystems
        }));
    }
};
