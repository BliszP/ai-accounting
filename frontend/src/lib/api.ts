/**
 * API Client
 *
 * Axios-based HTTP client for backend API communication
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Create Axios instance
 */
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor - Add auth token
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle errors
 */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      // Server responded with error
      const status = error.response.status;

      if (status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }

      if (status === 429) {
        // Rate limited
        console.error('Rate limit exceeded. Please try again later.');
      }
    } else if (error.request) {
      // Request made but no response
      console.error('No response from server. Please check your connection.');
    } else {
      // Error setting up request
      console.error('Error:', error.message);
    }

    return Promise.reject(error);
  }
);

/**
 * API client exports
 */
export { api };
export default api;

/**
 * Type-safe API methods
 */
export const apiClient = {
  /**
   * GET request
   */
  get: <T = any>(url: string, params?: any) =>
    api.get<T>(url, { params }).then((res) => res.data),

  /**
   * POST request
   */
  post: <T = any>(url: string, data?: any) =>
    api.post<T>(url, data).then((res) => res.data),

  /**
   * PUT request
   */
  put: <T = any>(url: string, data?: any) =>
    api.put<T>(url, data).then((res) => res.data),

  /**
   * DELETE request
   */
  delete: <T = any>(url: string) =>
    api.delete<T>(url).then((res) => res.data),

  /**
   * Upload file
   */
  upload: <T = any>(url: string, formData: FormData, onProgress?: (progress: number) => void) =>
    api.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    }).then((res) => res.data),
};

/**
 * Health check
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    const response = await apiClient.get('/api/health');
    return response.status === 'ok';
  } catch {
    return false;
  }
}
