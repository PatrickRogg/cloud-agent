import { CLOUD_AGENT } from '@repo/common/constants';
import { logger } from '@repo/common/logger';
import { machineRouter } from '@routes/machine';
import { Hono } from 'hono';
import { tasksRouter } from './routes/tasks';

const app = new Hono();

app.use('*', async (c, next) => {
  // Skip auth for health check endpoint
  if (c.req.path === '/health') {
    return next();
  }

  const apiKey = c.req.header('x-api-key') || c.req.header('authorization')?.replace('Bearer ', '');
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    logger.error('API_KEY environment variable not set');
    return c.json({ error: 'Server configuration error' }, 500);
  }

  if (!apiKey) {
    return c.json(
      { error: 'API key required. Provide via x-api-key header or Authorization: Bearer <key>' },
      401
    );
  }

  if (apiKey !== expectedApiKey) {
    logger.warn('Invalid API key attempt:', { providedKey: apiKey.substring(0, 8) + '...' });
    return c.json({ error: 'Invalid API key' }, 401);
  }

  return next();
});

app.route('/tasks', tasksRouter);
app.route('/machine', machineRouter);

app.get('/health', c => {
  return c.json({
    status: 'ok'
  });
});

// 404 handler
app.notFound(c => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  logger.error('Server error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message
    },
    500
  );
});

export default {
  port: CLOUD_AGENT.VM_API_PORT,
  fetch: app.fetch
};
