import { StreamableHTTPTransport } from '@hono/mcp';
import { mcpServer } from '@mcp';
import { Hono } from 'hono';

const app = new Hono();

app.all('/mcp', async c => {
  const transport = new StreamableHTTPTransport();
  await mcpServer.connect(transport);
  return transport.handleRequest(c);
});

app.get('/health', c => {
  return c.json({ status: 'ok' });
});

export default {
  port: 8000,
  fetch: app.fetch
};
