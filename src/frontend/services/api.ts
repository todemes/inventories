import { Uniform, Staff, Assignment, FormResponse } from '../types';

const API_BASE_URL = '/api';

export const api = {
  // Uniform endpoints
  getUniforms: async (): Promise<Uniform[]> => {
    const response = await fetch(`${API_BASE_URL}/uniforms`);
    return response.json();
  },

  addUniform: async (uniform: Omit<Uniform, 'id'>): Promise<FormResponse> => {
    const response = await fetch(`${API_BASE_URL}/uniforms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uniform),
    });
    return response.json();
  },

  updateUniformStock: async (id: number, stock: number): Promise<FormResponse> => {
    const response = await fetch(`${API_BASE_URL}/uniforms/${id}/stock`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stock }),
    });
    return response.json();
  },

  deleteUniform: async (id: number): Promise<FormResponse> => {
    const response = await fetch(`${API_BASE_URL}/uniforms/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // Staff endpoints
  getStaff: async (): Promise<Staff[]> => {
    const response = await fetch(`${API_BASE_URL}/staff`);
    return response.json();
  },

  addStaff: async (staff: Omit<Staff, 'id'>): Promise<FormResponse> => {
    const response = await fetch(`${API_BASE_URL}/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(staff),
    });
    return response.json();
  },

  // Assignment endpoints
  getAssignments: async (): Promise<Assignment[]> => {
    const response = await fetch(`${API_BASE_URL}/assignments`);
    return response.json();
  },

  assignUniform: async (staffId: number, uniformId: number): Promise<FormResponse> => {
    const response = await fetch(`${API_BASE_URL}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ staff_id: staffId, uniform_id: uniformId }),
    });
    return response.json();
  },

  returnUniform: async (assignmentId: number): Promise<FormResponse> => {
    const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/return`, {
      method: 'PUT',
    });
    return response.json();
  },
}; 