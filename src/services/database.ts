import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials:');
  console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_KEY:', supabaseKey ? 'Set' : 'Missing');
  throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_KEY environment variables.');
}

console.log('Initializing Supabase client...');
const supabase = createClient(supabaseUrl, supabaseKey);

export interface DatabaseResult {
  lastID?: number;
  changes?: number;
}

export async function initializeDatabase(): Promise<void> {
  try {
    console.log('Initializing database...');
    
    // Test the connection first
    const { data: testData, error: testError } = await supabase
      .from('uniforms')
      .select('count')
      .limit(1);
      
    if (testError) {
      console.error('Database connection test failed:', testError);
      throw testError;
    }
    
    console.log('Database connection successful');
    
    // Create tables if they don't exist
    const { error: uniformsError } = await supabase.rpc('create_uniforms_table');
    if (uniformsError) {
      console.error('Error creating uniforms table:', uniformsError);
      throw uniformsError;
    }

    const { error: stockHistoryError } = await supabase.rpc('create_stock_history_table');
    if (stockHistoryError) {
      console.error('Error creating stock history table:', stockHistoryError);
      throw stockHistoryError;
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Promisified database methods
export async function dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    console.log('Executing query:', sql, 'with params:', params);
    const { data, error } = await supabase.rpc('execute_query', { query: sql, params });
    if (error) {
      console.error('Query execution error:', error);
      throw error;
    }
    return data as T[];
  } catch (error) {
    console.error('Error in dbAll:', error);
    throw error;
  }
}

export async function dbGet<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  try {
    console.log('Executing query:', sql, 'with params:', params);
    const { data, error } = await supabase.rpc('execute_query', { query: sql, params });
    if (error) {
      console.error('Query execution error:', error);
      throw error;
    }
    return data?.[0] as T | undefined;
  } catch (error) {
    console.error('Error in dbGet:', error);
    throw error;
  }
}

export async function dbRun(sql: string, params: any[] = []): Promise<DatabaseResult> {
  try {
    console.log('Executing query:', sql, 'with params:', params);
    const { data, error } = await supabase.rpc('execute_query', { query: sql, params });
    if (error) {
      console.error('Query execution error:', error);
      throw error;
    }
    return { lastID: data?.lastID, changes: data?.changes };
  } catch (error) {
    console.error('Error in dbRun:', error);
    throw error;
  }
} 