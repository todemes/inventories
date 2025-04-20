import express from 'express';
import { StaffController } from '../controllers/staffController';

const router = express.Router();
let staffController: StaffController;

const initController = () => {
  if (!staffController) {
    staffController = new StaffController();
  }
  return staffController;
};

// Get all staff members
router.get('/', async (req, res) => {
  try {
    const controller = initController();
    const staff = await controller.getAllStaff();
    res.json(staff);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Add new staff member
router.post('/', async (req, res) => {
  try {
    const controller = initController();
    const staff = await controller.addStaff(req.body);
    res.status(201).json(staff);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get staff assignments
router.get('/assignments/:staffId?', async (req, res) => {
  try {
    const controller = initController();
    const staffId = req.params.staffId ? parseInt(req.params.staffId) : undefined;
    const assignments = await controller.getStaffAssignments(staffId);
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Assign uniform to staff
router.post('/assign', async (req, res) => {
  try {
    const controller = initController();
    const assignment = await controller.assignUniform({
      staff_id: req.body.staff_id,
      uniform_id: req.body.uniform_id,
      assigned_date: new Date().toISOString(),
      status: 'assigned'
    });
    res.status(201).json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Return or discard uniform
router.post('/return/:assignmentId', async (req, res) => {
  try {
    const controller = initController();
    const assignmentId = parseInt(req.params.assignmentId);
    const returnStatus = req.body.status as 'returned' | 'discarded';
    const notes = req.body.notes as string | null;
    
    if (!['returned', 'discarded'].includes(returnStatus)) {
      res.status(400).json({ error: 'Error: Invalid return status' });
      return;
    }
    
    await controller.returnUniform(assignmentId, returnStatus, notes);
    res.json({ message: 'Uniform returned successfully' });
  } catch (error: any) {
    res.status(500).json({ error: `Error: ${error.message || 'Internal server error'}` });
  }
});

// Delete staff member
router.delete('/:id', async (req, res) => {
  try {
    const controller = initController();
    const staffId = parseInt(req.params.id);
    await controller.deleteStaff(staffId);
    res.json({ message: 'Staff member deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: `Error: ${error.message || 'Internal server error'}` });
  }
});

// Export staff assignments to CSV
router.get('/export', async (req, res) => {
  try {
    const controller = initController();
    const csv = await controller.exportToCSV();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=staff_assignments.csv');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 