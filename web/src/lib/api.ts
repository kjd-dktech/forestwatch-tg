/**
 * API Client pour ForestWatch Togo
 * Connecte le frontend Next.js au backend FastAPI existant.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'not_set';

export interface PredictPixelResponse {
  prediction_label: string;
  confidence_score: number;
  latitude?: number;
  longitude?: number;
}

export interface PredictFileResponse {
  job_id: string;
  filename?: string;
  rows_processed?: number;
  is_mappable?: boolean;
  predictions: PredictPixelResponse[];
}

const getDefaultHeaders = () => ({
  'X-API-Key': API_KEY,
});

export const api = {
  /**
   * Récupère un job depuis le backend de façon asynchrone (SWR)
   */
  async getJobResults(jobId: string): Promise<PredictFileResponse> {
    const response = await fetch(`${API_URL}/predict/job/${jobId}`, {
      method: 'GET',
      headers: getDefaultHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(errorData || 'Erreur lors de la récupération du job');
    }

    return response.json();
  },

  /**
   * Vérifie l'état de santé de l'API et si le modèle ML est chargé
   */
  async checkHealth() {
    try {
      const response = await fetch(`${API_URL}/`, {
        headers: getDefaultHeaders(),
      });
      if (!response.ok) throw new Error('API non reachable');
      return await response.json();
    } catch (error) {
      console.error('Erreur API (checkHealth):', error);
      throw error;
    }
  },

  /**
   * Requête unitaire pour un pixel (nécessite les 18 features de Sentinel-2)
   */
  async predictPixel(data: Record<string, any>): Promise<PredictPixelResponse> {
    const response = await fetch(`${API_URL}/predict/pixel/`, {
      method: 'POST',
      headers: {
        ...getDefaultHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(errorData || 'Erreur lors de la prédiction du pixel');
    }

    return response.json();
  },

  /**
   * Envoi d'un fichier métier (GeoJSON, CSV) pour générer un lot (batch) de prédictions.
   */
  async predictFile(file: File): Promise<PredictFileResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/predict/file/`, {
      method: 'POST',
      headers: getDefaultHeaders(),
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error("Le fichier est trop volumineux (max 50 MB)");
      }
      const errorData = await response.text();
      throw new Error(errorData || 'Erreur lors de la prédiction du fichier');
    }

    return response.json();
  }
};
