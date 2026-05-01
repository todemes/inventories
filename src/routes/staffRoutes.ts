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
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.toLowerCase() : null;
    const staff = statusFilter === 'active'
      ? await controller.getActiveStaff()
      : await controller.getAllStaff();
    res.json(staff);
  } catch (error: any) {
    const status = mapErrorToStatus(error);
    res.status(status).json({ error: error.message || 'Internal server error' });
  }
});

// Add new staff member
router.post('/', async (req, res) => {
  try {
    const controller = initController();
    const normalizedStatus: 'active' | 'inactive' = typeof req.body.status === 'string' && req.body.status.toLowerCase() === 'inactive' ? 'inactive' : 'active';
    const payload = {
      name: typeof req.body.name === 'string' ? req.body.name : '',
      department: typeof req.body.department === 'string' ? req.body.department : '',
      full_name: typeof req.body.full_name === 'string' ? req.body.full_name : null,
      starting_date: typeof req.body.starting_date === 'string' && req.body.starting_date ? req.body.starting_date : null,
      birthday: typeof req.body.birthday === 'string' && req.body.birthday ? req.body.birthday : null,
      status: normalizedStatus
    };
    const staff = await controller.addStaff(payload);
    res.status(201).json(staff);
  } catch (error: any) {
    const status = mapErrorToStatus(error);
    res.status(status).json({ error: error.message || 'Internal server error' });
  }
});

// Update staff member
router.put('/:id', async (req, res) => {
  try {
    const staffId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(staffId) || staffId < 1) {
      res.status(400).json({ error: 'Error: Invalid staff identifier' });
      return;
    }
    const controller = initController();
    const statusInput = typeof req.body.status === 'string' ? req.body.status.toLowerCase() : undefined;
    const statusUpdate: 'active' | 'inactive' | undefined = typeof statusInput === 'string'
        ? (statusInput === 'inactive' ? 'inactive' : 'active')
        : undefined;
    const updates = {
      name: typeof req.body.name === 'string' ? req.body.name : undefined,
      department: typeof req.body.department === 'string' ? req.body.department : undefined,
      full_name: typeof req.body.full_name === 'string' ? req.body.full_name : undefined,
      starting_date: typeof req.body.starting_date === 'string' ? req.body.starting_date : undefined,
      birthday: typeof req.body.birthday === 'string' ? req.body.birthday : undefined,
      status: statusUpdate
    };
    const staff = await controller.updateStaff(staffId, updates);
    res.json(staff);
  } catch (error: any) {
    const status = mapErrorToStatus(error);
    res.status(status).json({ error: error.message || 'Internal server error' });
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
    const status = mapErrorToStatus(error);
    res.status(status).json({ error: error.message || 'Internal server error' });
  }
});

// Assign uniform to staff
router.post('/assign', async (req, res) => {
  try {
    const controller = initController();
    const condition = typeof req.body.condition === 'string' ? req.body.condition : 'New';
    const allowedConditions = ['New', 'Good', 'Fair', 'Poor'];
    const assignedCondition = allowedConditions.includes(condition) ? condition : 'New';
    const assignedByRaw = typeof req.body.assigned_by === 'string' ? req.body.assigned_by.trim() : '';
    const vessel = typeof req.body.vessel === 'string' ? req.body.vessel : '';
    const storageLocation = typeof req.body.storage_location === 'string' ? req.body.storage_location : '';
    const staffId = Number.parseInt(req.body.staff_id, 10);
    const uniformId = Number.parseInt(req.body.uniform_id, 10);
    if (!Number.isInteger(staffId) || staffId < 1 || !Number.isInteger(uniformId) || uniformId < 1) {
      res.status(400).json({ error: 'Error: Invalid staff or uniform selection' });
      return;
    }
    if (!assignedByRaw) {
      res.status(400).json({ error: 'Error: Assigned by is required' });
      return;
    }
    if (assignedByRaw.length > 100) {
      res.status(400).json({ error: 'Error: Assigned by value is too long' });
      return;
    }
    const rawQuantity = req.body.quantity;
    const quantity = Number.parseInt(rawQuantity, 10);
    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ error: 'Error: Quantity must be at least 1' });
      return;
    }

    const assignment = await controller.assignUniform({
      staff_id: staffId,
      uniform_id: uniformId,
      assigned_date: new Date().toISOString(),
      status: 'assigned',
      assigned_condition: assignedCondition,
      quantity,
      assigned_by: assignedByRaw,
      vessel: vessel as 'yin' | 'yang',
      storage_location: storageLocation
    });
    res.status(201).json(assignment);
  } catch (error: any) {
    const status = mapErrorToStatus(error);
    res.status(status).json({ error: error.message || 'Internal server error' });
  }
});

// Return or discard uniform
router.post('/return/:assignmentId', async (req, res) => {
  try {
    const controller = initController();
    const assignmentId = parseInt(req.params.assignmentId);
    const returnStatus = req.body.status as 'returned' | 'discarded';
    const conditionInput = typeof req.body.condition === 'string' ? req.body.condition.trim() : '';
    const reasonInput = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    const rawQuantity = req.body.quantity;
    const quantity = Number.parseInt(rawQuantity, 10);
    
    if (!['returned', 'discarded'].includes(returnStatus)) {
      res.status(400).json({ error: 'Error: Invalid return status' });
      return;
    }
    if (!conditionInput || conditionInput.length > 15) {
      res.status(400).json({ error: 'Error: Invalid return condition' });
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ error: 'Error: Invalid return quantity' });
      return;
    }
    
    if (reasonInput.length > 250) {
      res.status(400).json({ error: 'Error: Reason is too long' });
      return;
    }

    await controller.returnUniform(assignmentId, returnStatus, conditionInput, quantity, reasonInput || null);
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
    const status = mapErrorToStatus(error);
    res.status(status).json({ error: `Error: ${error.message || 'Internal server error'}` });
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

// Get all staff with their assignments
router.get('/with-assignments', async (req, res) => {
  try {
    const controller = initController();
    const staffWithAssignments = await controller.getAllStaffWithAssignments();
    res.json(staffWithAssignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 
const mapErrorToStatus = (error: any): number => {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (!message) {
    return 500;
  }
  const lowered = message.toLowerCase();
  if (
    lowered.includes('cannot be set to inactive') ||
    lowered.includes('already exists') ||
    lowered.includes('name is required') ||
    lowered.includes('department is required') ||
    lowered.includes('invalid staff id') ||
    lowered.includes('staff member not found') ||
    lowered.includes('selected location') ||
    lowered.includes('available in the selected location') ||
    lowered.includes('storage location') ||
    lowered.includes('vessel')
  ) {
    return 400;
  }
  return 500;
};
