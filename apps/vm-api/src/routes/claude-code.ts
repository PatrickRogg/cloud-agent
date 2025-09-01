import { query } from '@anthropic-ai/claude-code';
import { zValidator } from '@hono/zod-validator';
import { logger } from '@repo/common/logger';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { mkdir } from 'node:fs/promises';
import { z } from 'zod';

export const agentsRoutes = new Hono();

const claudeCodeSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  options: z
    .object({
      maxTurns: z.number().int().min(1).max(20).default(5),
      allowedTools: z
        .array(z.enum(['Bash', 'Read', 'Write', 'WebSearch', 'Edit']))
        .default(['Bash', 'Read', 'WebSearch'])
        .optional(),
      timeout: z
        .number()
        .int()
        .min(1000)
        .max(20 * 60_000)
        .default(60_000) // 1 second to 20 minutes,
    })
    .optional()
});

agentsRoutes.post('/claude-code/run', zValidator('json', claudeCodeSchema), async c => {
  const { taskId, prompt, options } = c.req.valid('json');

  return stream(c, async stream => {
    const abortController = new AbortController();

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, options?.timeout);

    // Handle abort events
    stream.onAbort(() => {
      logger.info('Stream aborted by client');
      abortController.abort();
    });

    try {
      // Send initial status
      const initialMessage =
        JSON.stringify({
          type: 'status',
          message: 'Starting Claude code execution...',
          timestamp: new Date().toISOString()
        }) + '\n';
      await stream.write(new TextEncoder().encode(initialMessage));

      let messageCount = 0;
      let hasResult = false;

      const cwd = `${process.env.WORKING_DIRECTORY}/task_${taskId}`;
      await mkdir(cwd, { recursive: true });

      // Execute Claude code with streaming
      for await (const message of query({
        prompt,
        options: {
          cwd,
          maxTurns: options?.maxTurns,
          allowedTools: options?.allowedTools,
          pathToClaudeCodeExecutable: process.env.PATH_TO_CLAUDE_CODE_EXECUTABLE,
          executable: 'bun',
          env: {
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN
          }
        }
      })) {
        messageCount++;

        const messageData =
          JSON.stringify({
            type: message.type,
            content: message,
            messageCount,
            timestamp: new Date().toISOString()
          }) + '\n';
        await stream.write(new TextEncoder().encode(messageData));
      }

      // Send completion status
      const completionMessage =
        JSON.stringify({
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

      const errorMessage =
        JSON.stringify({
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
