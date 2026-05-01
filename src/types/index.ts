export type Vessel = 'yin' | 'yang';

export interface StockLocation {
  id?: number;
  uniform_id?: number;
  vessel: Vessel;
  storage_location: string;
  quantity: number;
}

export interface Uniform {
  id?: number;
  type: string;
  size: string;
  color: string;
  current_stock: number;
  reorder_level?: number;
  locations?: StockLocation[];
}

export interface Staff {
  id?: number;
  name: string;
  department: string;
  full_name?: string;
  starting_date?: string | null;
  birthday?: string | null;
  status?: 'active' | 'inactive';
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
  assigned_condition?: 'New' | 'Good' | 'Fair' | 'Poor';
  returned_condition?: string | null;
  quantity: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
} 
