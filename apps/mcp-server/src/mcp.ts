import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { tools } from '@tools';

export const mcpServer = new McpServer({
  name: 'mcp-agent',
  version: '0.0.1'
});

tools.forEach(tool => {
  mcpServer.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema
    },
    tool.callback
  );
});
