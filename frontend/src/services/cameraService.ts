import api from "./api";

export interface Camera {
    camera_id: number;
    org_id: number;
    camera_type: string;
    location: string;
    connection_url?: string;
    description?: string;
    status: string;
}

export interface CameraCreate {
    org_id: number;
    camera_type: string;
    location: string;
    connection_url?: string;
    description?: string;
}

export const getCameras = async (): Promise<Camera[]> => {
    const res = await api.get<Camera[]>("/cameras");
    return res.data;
};

export const addCamera = async (data: CameraCreate): Promise<Camera> => {
    const res = await api.post<Camera>("/cameras", data);
    return res.data;
};

export const deleteCamera = async (id: number): Promise<void> => {
    await api.delete(`/cameras/${id}`);
};
