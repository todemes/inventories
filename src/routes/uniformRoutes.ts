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
    const type = typeof req.body.type === 'string' ? req.body.type : '';
    const size = typeof req.body.size === 'string' ? req.body.size : '';
    const color = typeof req.body.color === 'string' ? req.body.color : '';
    const stockRaw = req.body.current_stock ?? req.body.currentStock;
    const updatedBy = typeof req.body.updatedBy === 'string' ? req.body.updatedBy : '';
    const reason = typeof req.body.reason === 'string' ? req.body.reason : '';
    const vessel = typeof req.body.vessel === 'string' ? req.body.vessel : '';
    const storageLocation = typeof req.body.storage_location === 'string' ? req.body.storage_location : '';

    const currentStock = Number.parseInt(stockRaw, 10);

    if (!Number.isInteger(currentStock) || currentStock < 0) {
      res.status(400).json({ error: 'Invalid stock quantity' });
      return;
    }

    const uniform = await controller.addUniform(
      {
        type: type.trim(),
        size: size.trim(),
        color: color.trim(),
        current_stock: currentStock,
        vessel,
        storage_location: storageLocation
      },
      updatedBy,
      reason
    );
    res.status(201).json(uniform);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Internal server error' });
  }
});

// Update uniform stock
router.put('/:id/stock', async (req, res) => {
  try {
    const controller = initController();
    const uniformId = parseInt(req.params.id);
    const newQuantity = Number.parseInt(req.body.newQuantity, 10);
    const reason = typeof req.body.reason === 'string' ? req.body.reason : '';
    const updatedBy = typeof req.body.updatedBy === 'string' ? req.body.updatedBy : '';
    const comment = typeof req.body.comment === 'string' ? req.body.comment : '';
    const vessel = typeof req.body.vessel === 'string' ? req.body.vessel : '';
    const storageLocation = typeof req.body.storage_location === 'string' ? req.body.storage_location : '';

    if (!Number.isInteger(newQuantity) || newQuantity < 0) {
      res.status(400).json({ error: 'Invalid stock quantity' });
      return;
    }

    await controller.updateStock(uniformId, newQuantity, reason, updatedBy, comment, {
      vessel,
      storage_location: storageLocation
    });
    res.json({ message: 'Stock updated successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Internal server error' });
  }
});

// Transfer stock between locations
router.post('/:id/transfer', async (req, res) => {
  try {
    const controller = initController();
    const uniformId = Number.parseInt(req.params.id, 10);
    const quantity = Number.parseInt(req.body.quantity, 10);
    const updatedBy = typeof req.body.updatedBy === 'string' ? req.body.updatedBy : '';
    const comment = typeof req.body.comment === 'string' ? req.body.comment : '';
    const from = req.body.from && typeof req.body.from === 'object' ? req.body.from : {};
    const to = req.body.to && typeof req.body.to === 'object' ? req.body.to : {};

    if (!Number.isInteger(uniformId) || uniformId < 1) {
      res.status(400).json({ error: 'Invalid uniform selection' });
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ error: 'Invalid transfer quantity' });
      return;
    }

    await controller.transferStock(
      uniformId,
      quantity,
      {
        vessel: typeof from.vessel === 'string' ? from.vessel : '',
        storage_location: typeof from.storage_location === 'string' ? from.storage_location : ''
      },
      {
        vessel: typeof to.vessel === 'string' ? to.vessel : '',
        storage_location: typeof to.storage_location === 'string' ? to.storage_location : ''
      },
      updatedBy,
      comment
    );
    res.json({ message: 'Stock transferred successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Internal server error' });
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
    const date = new Date().toISOString().split('T')[0];
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=stock_update_history_${date}.csv`);
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

// Delete assignment history entries (returned status only)
router.post('/assignment-history/delete', async (req, res) => {
  try {
    const controller = initController();
    const idsRaw = Array.isArray(req.body.ids) ? req.body.ids : [];
    const parsedIds: number[] = [];

    idsRaw.forEach((value: unknown) => {
      let parsed: number;
      if (typeof value === 'number') {
        parsed = value;
      } else if (typeof value === 'string') {
        parsed = parseInt(value, 10);
      } else {
        parsed = NaN;
      }

      if (Number.isInteger(parsed) && parsed > 0) {
        parsedIds.push(parsed);
      }
    });

    const validIds = Array.from(new Set(parsedIds));
    if (!validIds.length) {
      res.status(400).json({ error: 'No valid history entries provided' });
      return;
    }

    await controller.deleteAssignmentHistory(validIds);
    res.json({ message: 'Selected history entries removed' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete history entries' });
  }
});

export default router;
