export interface Uniform {
  id?: number;
  type: string;
  size: string;
  color: string;
  current_stock: number;
  reorder_level?: number;
}

export interface Staff {
  id?: number;
  name: string;
  department: string;
}

export interface StockMovement {
  id?: number;
  uniform_id: number;
  movement_type: 'addition' | 'subtraction' | 'assignment' | 'return';
  quantity: number;
  date?: string;
  notes?: string;
}

export interface StaffAssignment {
  id?: number;
  staff_id: number;
  uniform_id: number;
  assigned_date?: string;
  returned_date?: string;
  status: 'assigned' | 'returned' | 'discarded';
  notes?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
} 