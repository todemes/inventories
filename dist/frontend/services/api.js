"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const API_BASE_URL = '/api';
exports.api = {
    // Uniform endpoints
    getUniforms: async () => {
        const response = await fetch(`${API_BASE_URL}/uniforms`);
        return response.json();
    },
    addUniform: async (uniform) => {
        const response = await fetch(`${API_BASE_URL}/uniforms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(uniform),
        });
        return response.json();
    },
    updateUniformStock: async (id, stock) => {
        const response = await fetch(`${API_BASE_URL}/uniforms/${id}/stock`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ stock }),
        });
        return response.json();
    },
    deleteUniform: async (id) => {
        const response = await fetch(`${API_BASE_URL}/uniforms/${id}`, {
            method: 'DELETE',
        });
        return response.json();
    },
    // Staff endpoints
    getStaff: async () => {
        const response = await fetch(`${API_BASE_URL}/staff`);
        return response.json();
    },
    addStaff: async (staff) => {
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
    getAssignments: async () => {
        const response = await fetch(`${API_BASE_URL}/assignments`);
        return response.json();
    },
    assignUniform: async (staffId, uniformId) => {
        const response = await fetch(`${API_BASE_URL}/assignments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ staff_id: staffId, uniform_id: uniformId }),
        });
        return response.json();
    },
    returnUniform: async (assignmentId) => {
        const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/return`, {
            method: 'PUT',
        });
        return response.json();
    },
};
