import express from 'express';
import { UniformController } from '../controllers/uniformController';

const router = express.Router();
let uniformController: UniformController;

const initController = () => {
  if (!uniformController) {
    uniformController = new UniformController();
  }
  return uniformController;
};

// Get all uniforms
router.get('/', async (req, res) => {
  try {
    const controller = initController();
    const uniforms = await controller.getAllUniforms();
    res.json(uniforms);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Add new uniform
router.post('/', async (req, res) => {
  try {
    const controller = initController();
    const uniform = await controller.addUniform(req.body);
    res.status(201).json(uniform);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update uniform stock
router.put('/:id/stock', async (req, res) => {
  try {
    const controller = initController();
    const uniformId = parseInt(req.params.id);
    const newQuantity = parseInt(req.body.newQuantity);
    
    await controller.updateStock(uniformId, newQuantity);
    res.json({ message: 'Stock updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete uniform
router.delete('/:id', async (req, res) => {
  try {
    const controller = initController();
    const uniformId = parseInt(req.params.id);
    await controller.deleteUniform(uniformId);
    res.json({ message: 'Uniform deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Export uniforms to CSV
router.get('/export', async (req, res) => {
  try {
    const controller = initController();
    const csv = await controller.exportToCSV();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=uniforms.csv');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get stock movement history
router.get('/stock-history', async (req, res) => {
  try {
    const controller = initController();
    const history = await controller.getStockHistory();
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Export history to CSV
router.get('/stock-history/export', async (req, res) => {
  try {
    const controller = initController();
    const csv = await controller.exportHistoryToCSV();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=uniform_history.csv');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get staff assignment history
router.get('/assignment-history', async (req, res) => {
  try {
    const controller = initController();
    const history = await controller.getAssignmentHistory();
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Export assignment history to CSV
router.get('/assignment-history/export', async (req, res) => {
  try {
    const controller = initController();
    const csv = await controller.exportAssignmentHistoryToCSV();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=uniform_assignments.csv');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 