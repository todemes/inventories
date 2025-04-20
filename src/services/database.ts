import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_KEY environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export interface DatabaseResult {
  lastID?: number;
  changes?: number;
}

export async function initializeDatabase(): Promise<void> {
  try {
    // Create tables if they don't exist
    const { error: uniformsError } = await supabase.rpc('create_uniforms_table');
    if (uniformsError) throw uniformsError;

    const { error: stockHistoryError } = await supabase.rpc('create_stock_history_table');
    if (stockHistoryError) throw stockHistoryError;

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Promisified database methods
export async function dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  const { data, error } = await supabase.rpc('execute_query', { query: sql, params });
  if (error) throw error;
  return data as T[];
}

export async function dbGet<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  const { data, error } = await supabase.rpc('execute_query', { query: sql, params });
  if (error) throw error;
  return data?.[0] as T | undefined;
}

export async function dbRun(sql: string, params: any[] = []): Promise<DatabaseResult> {
  const { data, error } = await supabase.rpc('execute_query', { query: sql, params });
  if (error) throw error;
  return { lastID: data?.lastID, changes: data?.changes };
} 