import { dbAll, dbGet, dbRun } from '../services/database';

type Vessel = 'yin' | 'yang';

interface StockLocation {
  id: number;
  uniform_id: number;
  vessel: Vessel;
  storage_location: string;
  quantity: number;
}

interface Uniform {
  id: number;
  type: string;
  size: string;
  color: string;
  current_stock: number;
  locations?: StockLocation[];
}

interface StockLocationInput {
  vessel?: string;
  storage_location?: string;
}

interface StockHistory {
  date: string;
  uniform_type: string;
  size: string;
  color: string;
  previous_quantity: number | null;
  new_quantity: number | null;
  quantity_change: number;
  vessel: Vessel | null;
  storage_location: string | null;
  reason: string | null;
  updated_by: string | null;
  notes: string | null;
}

const ALLOWED_VESSELS = new Set(['yin', 'yang']);

function normalizeVessel(value: string | undefined): Vessel {
  const normalized = (value || 'yin').trim().toLowerCase();
  if (!ALLOWED_VESSELS.has(normalized)) {
    throw new Error('Vessel must be Yin or Yang');
  }
  return normalized as Vessel;
}

function normalizeStorageLocation(value: string | undefined): string {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    throw new Error('Storage location is required');
  }
  if (trimmed.length > 100) {
    throw new Error('Storage location is too long');
  }
  return trimmed;
}

interface AssignmentHistory {
  assignment_id: number;
  assigned_date: string;
  returned_date: string | null;
  assigned_by: string | null;
  staff_name: string;
  department: string;
  uniform_type: string;
  size: string;
  color: string;
  status: 'assigned' | 'returned' | 'discarded';
  assigned_condition: string | null;
  returned_condition: string | null;
  quantity: number;
  notes: string | null;
}

export class UniformController {
  async getAllUniforms(): Promise<Uniform[]> {
    const uniforms = await dbAll<Uniform>('SELECT * FROM uniforms ORDER BY type, size, color');
    if (!uniforms.length) {
      return uniforms;
    }

    const locations = await dbAll<StockLocation>(`
      SELECT id, uniform_id, vessel, storage_location, quantity
      FROM stock_locations
      ORDER BY vessel, storage_location
    `);
    const locationsByUniform = locations.reduce((acc, location) => {
      if (!acc[location.uniform_id]) {
        acc[location.uniform_id] = [];
      }
      acc[location.uniform_id].push(location);
      return acc;
    }, {} as Record<number, StockLocation[]>);

    return uniforms.map(uniform => ({
      ...uniform,
      locations: locationsByUniform[uniform.id] || []
    }));
  }

  async getUniformById(id: number): Promise<Uniform | undefined> {
    return dbGet<Uniform>('SELECT * FROM uniforms WHERE id = ?', [id]);
  }

  async addUniform(
    uniform: Omit<Uniform, 'id'> & StockLocationInput,
    updatedBy: string,
    reason: string = 'New uniform added'
  ): Promise<Uniform> {
    const type = (uniform.type || '').trim();
    const size = (uniform.size || '').trim();
    const color = (uniform.color || '').trim();
    const currentStock = Number.parseInt(String(uniform.current_stock), 10);
    const vessel = normalizeVessel(uniform.vessel);
    const storageLocation = normalizeStorageLocation(uniform.storage_location);
    const trimmedUpdatedBy = (updatedBy || '').trim();
    const trimmedReason = (reason || '').trim() || 'New uniform added';

    if (!type || !size || !color) {
      throw new Error('Uniform type, size, and color are required');
    }

    if (!Number.isInteger(currentStock) || currentStock < 0) {
      throw new Error('Current stock must be zero or greater');
    }

    if (!trimmedUpdatedBy) {
      throw new Error('Updated by is required');
    }
    if (trimmedUpdatedBy.length > 100) {
      throw new Error('Updated by value is too long');
    }
    if (trimmedReason.length > 100) {
      throw new Error('Reason is too long');
    }

    const timestamp = new Date().toISOString();

    await dbRun('BEGIN TRANSACTION');
    try {
      const result = await dbRun(
        'INSERT INTO uniforms (type, size, color, current_stock) VALUES (?, ?, ?, ?)',
        [type, size, color, currentStock]
      );

      const uniformId = result.lastID!;

      await dbRun(
        `INSERT INTO stock_locations (uniform_id, vessel, storage_location, quantity, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uniformId, vessel, storageLocation, currentStock, timestamp]
      );

      await dbRun(
        `INSERT INTO stock_history (uniform_id, quantity_change, date, notes, previous_quantity, new_quantity, reason, updated_by, vessel, storage_location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uniformId,
          currentStock,
          timestamp,
          null,
          0,
          currentStock,
          trimmedReason,
          trimmedUpdatedBy,
          vessel,
          storageLocation
        ]
      );

      await dbRun('COMMIT');
      return {
        id: uniformId,
        type,
        size,
        color,
        current_stock: currentStock,
        locations: [{ id: 0, uniform_id: uniformId, vessel, storage_location: storageLocation, quantity: currentStock }]
      };
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  }

  async updateStock(
    uniformId: number,
    newQuantity: number,
    reason: string,
    updatedBy: string,
    comment: string = '',
    locationInput: StockLocationInput = {}
  ): Promise<void> {
    const uniform = await this.getUniformById(uniformId);
    if (!uniform) {
      throw new Error('Uniform not found');
    }

    const trimmedReason = (reason || '').trim();
    const vessel = normalizeVessel(locationInput.vessel);
    const storageLocation = normalizeStorageLocation(locationInput.storage_location);
    const trimmedUpdatedBy = (updatedBy || '').trim();
    const trimmedComment = (comment || '').trim();

    if (!trimmedReason) {
      throw new Error('Reason is required');
    }
    if (trimmedReason.length > 100) {
      throw new Error('Reason is too long');
    }
    if (!trimmedUpdatedBy) {
      throw new Error('Updated by is required');
    }
    if (trimmedUpdatedBy.length > 100) {
      throw new Error('Updated by value is too long');
    }
    if (trimmedComment.length > 250) {
      throw new Error('Comment must be 250 characters or fewer');
    }

    const timestamp = new Date().toISOString();
    let location = await dbGet<StockLocation>(
      `SELECT * FROM stock_locations
       WHERE uniform_id = ? AND vessel = ? AND lower(trim(storage_location)) = lower(trim(?))`,
      [uniformId, vessel, storageLocation]
    );
    const placeholderLocation = storageLocation.toLowerCase() === 'unspecified'
      ? undefined
      : await dbGet<StockLocation>(
          `SELECT * FROM stock_locations
           WHERE uniform_id = ? AND vessel = ? AND lower(trim(storage_location)) = 'unspecified'`,
          [uniformId, vessel]
        );
    const shouldMovePlaceholder = Boolean(
      placeholderLocation &&
      (!location || Number(location.quantity || 0) === 0) &&
      Number(placeholderLocation.quantity || 0) > 0
    );
    const previousLocationQuantity = shouldMovePlaceholder
      ? Number(placeholderLocation?.quantity || 0)
      : Number(location?.quantity || 0);
    const quantityChange = newQuantity - previousLocationQuantity;

    await dbRun('BEGIN TRANSACTION');
    try {
      if (shouldMovePlaceholder && placeholderLocation) {
        if (location) {
          await dbRun('DELETE FROM stock_locations WHERE id = ?', [location.id]);
        }
        await dbRun(
          `UPDATE stock_locations
           SET quantity = ?, vessel = ?, storage_location = ?, updated_at = ?
           WHERE id = ?`,
          [newQuantity, vessel, storageLocation, timestamp, placeholderLocation.id]
        );
      } else if (location) {
        await dbRun(
          `UPDATE stock_locations
           SET quantity = ?, storage_location = ?, updated_at = ?
           WHERE id = ?`,
          [newQuantity, storageLocation, timestamp, location.id]
        );
      } else {
        await dbRun(
          `INSERT INTO stock_locations (uniform_id, vessel, storage_location, quantity, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [uniformId, vessel, storageLocation, newQuantity, timestamp]
        );
      }

      const total = await dbGet<{ total: number }>(
        'SELECT COALESCE(SUM(quantity), 0) as total FROM stock_locations WHERE uniform_id = ?',
        [uniformId]
      );
      await dbRun(
        'UPDATE uniforms SET current_stock = ? WHERE id = ?',
        [total?.total || 0, uniformId]
      );

      await dbRun(
        `INSERT INTO stock_history (uniform_id, quantity_change, date, notes, previous_quantity, new_quantity, reason, updated_by, vessel, storage_location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uniformId,
          quantityChange,
          timestamp,
          trimmedComment || null,
          previousLocationQuantity,
          newQuantity,
          trimmedReason,
          trimmedUpdatedBy,
          vessel,
          storageLocation
        ]
      );
      await dbRun('COMMIT');
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  }

  async transferStock(
    uniformId: number,
    quantity: number,
    fromInput: StockLocationInput,
    toInput: StockLocationInput,
    updatedBy: string,
    comment: string = ''
  ): Promise<void> {
    const uniform = await this.getUniformById(uniformId);
    if (!uniform) {
      throw new Error('Uniform not found');
    }

    const transferQuantity = Number.parseInt(String(quantity), 10);
    if (!Number.isInteger(transferQuantity) || transferQuantity < 1) {
      throw new Error('Transfer quantity must be at least 1');
    }

    const fromVessel = normalizeVessel(fromInput.vessel);
    const fromStorageLocation = normalizeStorageLocation(fromInput.storage_location);
    const toVessel = normalizeVessel(toInput.vessel);
    const toStorageLocation = normalizeStorageLocation(toInput.storage_location);
    const trimmedUpdatedBy = (updatedBy || '').trim();
    const trimmedComment = (comment || '').trim();

    if (!trimmedUpdatedBy) {
      throw new Error('Updated by is required');
    }
    if (trimmedUpdatedBy.length > 100) {
      throw new Error('Updated by value is too long');
    }
    if (trimmedComment.length > 250) {
      throw new Error('Comment must be 250 characters or fewer');
    }
    if (fromVessel === toVessel && fromStorageLocation.toLowerCase() === toStorageLocation.toLowerCase()) {
      throw new Error('Choose a different destination location');
    }

    const timestamp = new Date().toISOString();

    await dbRun('BEGIN TRANSACTION');
    try {
      const fromLocation = await dbGet<StockLocation>(
        `SELECT * FROM stock_locations
         WHERE uniform_id = ? AND vessel = ? AND lower(trim(storage_location)) = lower(trim(?))`,
        [uniformId, fromVessel, fromStorageLocation]
      );

      if (!fromLocation || Number(fromLocation.quantity || 0) < transferQuantity) {
        throw new Error('Transfer quantity cannot exceed the source location stock');
      }

      const toLocation = await dbGet<StockLocation>(
        `SELECT * FROM stock_locations
         WHERE uniform_id = ? AND vessel = ? AND lower(trim(storage_location)) = lower(trim(?))`,
        [uniformId, toVessel, toStorageLocation]
      );

      const fromPrevious = Number(fromLocation.quantity || 0);
      const fromNew = fromPrevious - transferQuantity;
      await dbRun(
        'UPDATE stock_locations SET quantity = ?, updated_at = ? WHERE id = ?',
        [fromNew, timestamp, fromLocation.id]
      );

      const toPrevious = Number(toLocation?.quantity || 0);
      const toNew = toPrevious + transferQuantity;
      if (toLocation) {
        await dbRun(
          'UPDATE stock_locations SET quantity = ?, updated_at = ? WHERE id = ?',
          [toNew, timestamp, toLocation.id]
        );
      } else {
        await dbRun(
          `INSERT INTO stock_locations (uniform_id, vessel, storage_location, quantity, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [uniformId, toVessel, toStorageLocation, toNew, timestamp]
        );
      }

      await dbRun(
        `INSERT INTO stock_history (uniform_id, quantity_change, date, notes, previous_quantity, new_quantity, reason, updated_by, vessel, storage_location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uniformId, -transferQuantity, timestamp, trimmedComment || null, fromPrevious, fromNew, 'Transfer out', trimmedUpdatedBy, fromVessel, fromStorageLocation]
      );
      await dbRun(
        `INSERT INTO stock_history (uniform_id, quantity_change, date, notes, previous_quantity, new_quantity, reason, updated_by, vessel, storage_location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uniformId, transferQuantity, timestamp, trimmedComment || null, toPrevious, toNew, 'Transfer in', trimmedUpdatedBy, toVessel, toStorageLocation]
      );

      const total = await dbGet<{ total: number }>(
        'SELECT COALESCE(SUM(quantity), 0) as total FROM stock_locations WHERE uniform_id = ?',
        [uniformId]
      );
      await dbRun('UPDATE uniforms SET current_stock = ? WHERE id = ?', [total?.total || 0, uniformId]);

      await dbRun('COMMIT');
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  }

  async deleteUniform(id: number): Promise<void> {
    // Check if uniform exists
    const uniform = await this.getUniformById(id);
    if (!uniform) {
      throw new Error('Uniform not found');
    }

    // Check if uniform is assigned to any staff
    const assignments = await dbGet<any>(
      `SELECT COUNT(*) as count FROM staff_assignments 
       WHERE uniform_id = ? AND returned_date IS NULL`,
      [id]
    );

    if (assignments && assignments.count > 0) {
      throw new Error('Cannot delete uniform that is currently assigned to staff');
    }

    await dbRun('DELETE FROM uniforms WHERE id = ?', [id]);
  }

  async getStockHistory(): Promise<StockHistory[]> {
    const records = await dbAll<any>(`
      SELECT 
        sh.date,
        sh.updated_by,
        sh.reason,
        sh.notes,
        sh.previous_quantity,
        sh.new_quantity,
        sh.quantity_change,
        sh.vessel,
        sh.storage_location,
        u.type as uniform_type,
        u.size,
        u.color
      FROM stock_history sh
      JOIN uniforms u ON sh.uniform_id = u.id
      ORDER BY sh.date DESC, sh.id DESC
    `);

    return records.map(record => ({
      date: record.date,
      uniform_type: record.uniform_type,
      size: record.size,
      color: record.color,
      previous_quantity: record.previous_quantity ?? null,
      new_quantity: record.new_quantity ?? null,
      quantity_change: record.quantity_change ?? 0,
      vessel: record.vessel ?? null,
      storage_location: record.storage_location ?? null,
      reason: record.reason ?? null,
      updated_by: record.updated_by ?? null,
      notes: record.notes ?? null
    }));
  }

  async exportHistoryToCSV(): Promise<string> {
    const history = await this.getStockHistory();
    const headers = [
      'Date',
      'Updated By',
      'Type',
      'Size',
      'Color',
      'Vessel',
      'Storage Location',
      'Previous Quantity',
      'New Quantity',
      'Change',
      'Reason'
    ];
    const rows = history.map(item => [
      item.date,
      item.updated_by || '',
      item.uniform_type,
      item.size,
      item.color,
      item.vessel ? item.vessel.toUpperCase() : '',
      item.storage_location || '',
      item.previous_quantity ?? '',
      item.new_quantity ?? '',
      item.quantity_change ?? 0,
      item.reason || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
  }

  async exportToCSV(): Promise<string> {
    // Get all uniforms
    const uniforms = await this.getAllUniforms();
    
    // Get active assignments (sum quantity of active uniforms)
    const assignments = await dbAll<any>(`
      SELECT 
        u.id as uniform_id,
        u.type as uniform_type,
        u.size as uniform_size,
        u.color as uniform_color,
        COALESCE(SUM(sa.quantity), 0) as assigned_count
      FROM staff_assignments sa
      JOIN uniforms u ON sa.uniform_id = u.id
      WHERE sa.status = 'assigned'
      GROUP BY u.id, u.type, u.size, u.color
    `);

    // Create a map of assigned counts
    const assignedCounts = assignments.reduce((acc, assignment) => {
      const key = assignment.uniform_id;
      acc[key] = assignment.assigned_count;
      return acc;
    }, {} as Record<number, number>);

    const headers = ['Type', 'Size', 'Color', 'Vessel', 'Storage Location', 'Location Stock', 'Total Stock', 'Assigned'];
    const rows = uniforms.flatMap(uniform => {
      const assignedCount = assignedCounts[uniform.id] || 0;
      const locations = uniform.locations && uniform.locations.length > 0
        ? uniform.locations
        : [{ vessel: null, storage_location: '', quantity: uniform.current_stock }];
      return locations.map(location => [
        uniform.type,
        uniform.size,
        uniform.color,
        location.vessel ? String(location.vessel).toUpperCase() : '',
        location.storage_location || '',
        location.quantity || 0,
        uniform.current_stock,
        assignedCount
      ]);
    });

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  async getAssignmentHistory(): Promise<AssignmentHistory[]> {
    return dbAll<AssignmentHistory>(`
      SELECT 
        sa.id as assignment_id,
        sa.assigned_date,
        sa.returned_date,
        sa.status,
        sa.assigned_condition,
        sa.returned_condition,
        sa.quantity,
        sa.assigned_by,
        s.name as staff_name,
        s.department,
        u.type as uniform_type,
        u.size,
        u.color,
        sa.notes
      FROM staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      JOIN uniforms u ON sa.uniform_id = u.id
      WHERE s.status = 'active'
      ORDER BY sa.assigned_date DESC
    `);
  }

  async exportAssignmentHistoryToCSV(): Promise<string> {
    const history = await this.getAssignmentHistory();
    const headers = [
      'Assigned Date',
      'Returned Date',
      'Staff',
      'Department',
      'Uniform Type',
      'Size',
      'Color',
      'Status',
      'Assigned By',
      'Assigned Condition',
      'Returned Condition',
      'Reason',
      'Quantity'
    ];
    const rows = history.map(item => [
      formatDateForCsv(item.assigned_date),
      formatDateForCsv(item.returned_date),
      item.staff_name,
      item.department,
      item.uniform_type,
      item.size,
      item.color,
      item.status,
      item.assigned_by || '',
      item.assigned_condition || '',
      item.returned_condition || '',
      item.notes || '',
      item.quantity || 1
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  async deleteAssignmentHistory(ids: number[]): Promise<void> {
    if (!ids.length) {
      return;
    }

    const placeholders = ids.map(() => '?').join(',');
    const records = await dbAll<{ id: number; status: string }>(
      `SELECT id, status FROM staff_assignments WHERE id IN (${placeholders})`,
      ids
    );

    if (records.length !== ids.length) {
      throw new Error('One or more selected entries were not found');
    }

    const allowedStatuses = new Set(['returned', 'discarded']);
    const notRemovable = records.filter(record => !allowedStatuses.has(String(record.status).toLowerCase()));
    if (notRemovable.length > 0) {
      throw new Error('Only entries with status "returned" or "discarded" can be removed');
    }

    await dbRun(`DELETE FROM staff_assignments WHERE id IN (${placeholders})`, ids);
  }
}
export function formatDateForCsv(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = MONTH_LABELS[date.getMonth()] || '';
  const year = String(date.getFullYear()).slice(-2);
  return month ? `${day}-${month}-${year}` : '';
}
