import { logger } from '@repo/common/logger';
import { clearMachineStatus, isMachineAvailable } from '@utils/task-status';
import { Hono } from 'hono';

export const machineRouter = new Hono();

machineRouter.get('/availability', async c => {
  try {
    const availability = await isMachineAvailable();
    return c.json({
      available: availability.available,
      currentTask: availability.currentTask || null
    });
  } catch (error) {
    logger.error('Failed to check machine availability:', error);
    return c.json({ error: 'Failed to check machine availability' }, 500);
  }
});

machineRouter.post('/clear', async c => {
  try {
    await clearMachineStatus();
    return c.json({ message: 'Machine status cleared successfully' });
  } catch (error) {
    logger.error('Failed to clear machine status:', error);
    return c.json({ error: 'Failed to clear machine status' }, 500);
  }
});
