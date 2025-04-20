export interface Uniform {
  id: number;
  type: string;
  size: string;
  color: string;
  stock: number;
}

export interface Staff {
  id: number;
  name: string;
  department: string;
  position: string;
}

export interface Assignment {
  id: number;
  uniform_id: number;
  staff_id: number;
  assigned_date: string;
  returned_date: string | null;
}

export interface FormResponse {
  success: boolean;
  message: string;
}

export type FlashMessage = {
  type: 'success' | 'danger' | 'warning' | 'info';
  message: string;
}; 