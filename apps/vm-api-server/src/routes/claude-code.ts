import { query } from '@anthropic-ai/claude-code';
import { zValidator } from '@hono/zod-validator';
import { logger } from '@repo/common/logger';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { z } from 'zod';

export const agentRoutes = new Hono();

const claudeCodeSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  maxTurns: z.number().int().min(1).max(20).default(5),
  systemPrompt: z.string().optional(),
  allowedTools: z
    .array(z.enum(['Bash', 'Read', 'Write', 'WebSearch', 'Edit']))
    .default(['Bash', 'Read', 'WebSearch'])
    .optional(),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(20 * 60_000)
    .default(60_000) // 1 second to 20 minutes
});

agentRoutes.post('/claude-code/run', zValidator('json', claudeCodeSchema), async c => {
  const { prompt, maxTurns, systemPrompt, allowedTools, timeout } = c.req.valid('json');

  return stream(c, async stream => {
    const abortController = new AbortController();

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    // Handle abort events
    stream.onAbort(() => {
      logger.info('Stream aborted by client');
      abortController.abort();
    });

    try {
      // Send initial status
      const initialMessage = JSON.stringify({
        type: 'status',
        message: 'Starting Claude code execution...',
        timestamp: new Date().toISOString()
      }) + '\n';
      await stream.write(new TextEncoder().encode(initialMessage));

      let messageCount = 0;
      let hasResult = false;

      // Execute Claude code with streaming
      for await (const message of query({
        prompt,
        options: {
          maxTurns,
          allowedTools
        }
      })) {
        messageCount++;

        // Stream each message as JSON lines
        const messageData = JSON.stringify({
          type: message.type,
          content: message,
          messageCount,
          timestamp: new Date().toISOString()
        }) + '\n';
        await stream.write(new TextEncoder().encode(messageData));

        // Handle different message types based on actual claude-code types
        if (message.type === 'result') {
          hasResult = true;
          const resultMessage = JSON.stringify({
            type: 'final_result',
            result: (message as any).result || message,
            messageCount,
            timestamp: new Date().toISOString()
          }) + '\n';
          await stream.write(new TextEncoder().encode(resultMessage));
        } else if ((message as any).type === 'error') {
          const errorMessage = JSON.stringify({
            type: 'error',
            error: (message as any).error || 'Unknown error occurred',
            messageCount,
            timestamp: new Date().toISOString()
          }) + '\n';
          await stream.write(new TextEncoder().encode(errorMessage));
          break;
        } else if ((message as any).type === 'tool_call') {
          const toolCallMessage = JSON.stringify({
            type: 'tool_execution',
            tool: (message as any).tool,
            input: (message as any).input,
            messageCount,
            timestamp: new Date().toISOString()
          }) + '\n';
          await stream.write(new TextEncoder().encode(toolCallMessage));
        } else if ((message as any).type === 'tool_result') {
          const toolResultMessage = JSON.stringify({
            type: 'tool_result',
            tool: (message as any).tool,
            result: (message as any).result,
            messageCount,
            timestamp: new Date().toISOString()
          }) + '\n';
          await stream.write(new TextEncoder().encode(toolResultMessage));
        }
      }

      // Send completion status
      const completionMessage = JSON.stringify({
        type: 'completed',
        message: hasResult
          ? 'Execution completed successfully'
          : 'Execution completed without final result',
        totalMessages: messageCount,
        timestamp: new Date().toISOString()
      }) + '\n';
      await stream.write(new TextEncoder().encode(completionMessage));
    } catch (error) {
      logger.error('Claude code execution error:', error);

      const errorMessage = JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }) + '\n';
      await stream.write(new TextEncoder().encode(errorMessage));
    } finally {
      clearTimeout(timeoutId);
    }
  });
});
