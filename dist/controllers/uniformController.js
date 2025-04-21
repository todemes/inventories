"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniformController = void 0;
const database_1 = require("../services/database");
class UniformController {
    async getAllUniforms() {
        return (0, database_1.dbAll)('SELECT * FROM uniforms ORDER BY type, size, color');
    }
    async getUniformById(id) {
        return (0, database_1.dbGet)('SELECT * FROM uniforms WHERE id = ?', [id]);
    }
    async addUniform(uniform) {
        const result = await (0, database_1.dbRun)('INSERT INTO uniforms (type, size, color, current_stock) VALUES (?, ?, ?, ?)', [uniform.type, uniform.size, uniform.color, uniform.current_stock]);
        return { ...uniform, id: result.lastID };
    }
    async updateStock(uniformId, newQuantity) {
        const uniform = await this.getUniformById(uniformId);
        if (!uniform) {
            throw new Error('Uniform not found');
        }
        const quantityChange = newQuantity - uniform.current_stock;
        await (0, database_1.dbRun)('UPDATE uniforms SET current_stock = ? WHERE id = ?', [newQuantity, uniformId]);
        // Record the stock movement in history
        await (0, database_1.dbRun)('INSERT INTO stock_history (uniform_id, quantity_change, date, notes) VALUES (?, ?, datetime("now"), ?)', [uniformId, quantityChange, `Stock updated from ${uniform.current_stock} to ${newQuantity}`]);
    }
    async deleteUniform(id) {
        // Check if uniform exists
        const uniform = await this.getUniformById(id);
        if (!uniform) {
            throw new Error('Uniform not found');
        }
        // Check if uniform is assigned to any staff
        const assignments = await (0, database_1.dbGet)(`SELECT COUNT(*) as count FROM staff_assignments 
       WHERE uniform_id = ? AND returned_date IS NULL`, [id]);
        if (assignments && assignments.count > 0) {
            throw new Error('Cannot delete uniform that is currently assigned to staff');
        }
        await (0, database_1.dbRun)('DELETE FROM uniforms WHERE id = ?', [id]);
    }
    async getStockHistory() {
        return (0, database_1.dbAll)(`
      SELECT 
        sh.date,
        u.type as uniform_type,
        u.size,
        u.color,
        sh.quantity_change,
        sh.notes
      FROM stock_history sh
      JOIN uniforms u ON sh.uniform_id = u.id
      ORDER BY sh.date DESC
    `);
    }
    async exportHistoryToCSV() {
        const history = await this.getStockHistory();
        const headers = ['Date', 'Type', 'Size', 'Color', 'Quantity Change', 'Notes'];
        const rows = history.map(item => [
            item.date,
            item.uniform_type,
            item.size,
            item.color,
            item.quantity_change,
            item.notes || ''
        ]);
        return [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
    }
    async exportToCSV() {
        // Get all uniforms
        const uniforms = await this.getAllUniforms();
        // Get active assignments
        const assignments = await (0, database_1.dbAll)(`
      SELECT 
        u.type as uniform_type,
        u.size as uniform_size,
        u.color as uniform_color,
        COUNT(*) as assigned_count
      FROM staff_assignments sa
      JOIN uniforms u ON sa.uniform_id = u.id
      WHERE sa.status = 'assigned'
      GROUP BY u.type, u.size, u.color
    `);
        // Create a map of assigned counts
        const assignedCounts = assignments.reduce((acc, assignment) => {
            const key = `${assignment.uniform_type}-${assignment.uniform_size}-${assignment.uniform_color}`;
            acc[key] = assignment.assigned_count;
            return acc;
        }, {});
        const headers = ['Type', 'Size', 'Color', 'Current Stock', 'Assigned'];
        const rows = uniforms.map(uniform => {
            const key = `${uniform.type}-${uniform.size}-${uniform.color}`;
            const assignedCount = assignedCounts[key] || 0;
            return [
                uniform.type,
                uniform.size,
                uniform.color,
                uniform.current_stock,
                assignedCount
            ];
        });
        return [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
    }
    async getAssignmentHistory() {
        return (0, database_1.dbAll)(`
      SELECT 
        sa.assigned_date,
        sa.returned_date,
        s.name as staff_name,
        s.department,
        u.type as uniform_type,
        u.size,
        u.color,
        sa.notes
      FROM staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      JOIN uniforms u ON sa.uniform_id = u.id
      ORDER BY sa.assigned_date DESC
    `);
    }
    async exportAssignmentHistoryToCSV() {
        const history = await this.getAssignmentHistory();
        const headers = ['Assigned Date', 'Returned Date', 'Staff', 'Department', 'Uniform Type', 'Size', 'Color', 'Notes'];
        const rows = history.map(item => [
            item.assigned_date,
            item.returned_date || '',
            item.staff_name,
            item.department,
            item.uniform_type,
            item.size,
            item.color,
            item.notes || ''
        ]);
        return [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
    }
}
exports.UniformController = UniformController;
