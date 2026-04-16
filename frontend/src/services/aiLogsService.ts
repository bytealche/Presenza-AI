import api from './api';

export interface AILogResponse {
    decision_id: number;
    attendance_id: number;
    user_name: string;
    model_name: string;
    confidence_score: number;
    decision_reason: string;
    created_at: string;
    final_status: string;
}

export const getAILogs = async (): Promise<AILogResponse[]> => {
    const response = await api.get('/ai-logs');
    return response.data;
};
