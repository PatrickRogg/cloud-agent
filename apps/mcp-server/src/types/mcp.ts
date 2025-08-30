import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  CallToolResult,
  ServerNotification,
  ServerRequest
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v3';

// A more direct callback type definition, removing the conditional aspect
export type McpToolCallback<
  TInputSchema extends z.ZodRawShape,
  TOutputSchema extends z.ZodRawShape | undefined
> = (
  args: z.objectOutputType<TInputSchema, z.ZodTypeAny>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) =>
  | (CallToolResult &
      (TOutputSchema extends undefined
        ? {}
        : { structuredContent: z.objectOutputType<NonNullable<TOutputSchema>, z.ZodTypeAny> }))
  | Promise<
      CallToolResult &
        (TOutputSchema extends undefined
          ? {}
          : { structuredContent: z.objectOutputType<NonNullable<TOutputSchema>, z.ZodTypeAny> })
    >;

export type McpTool<
  TInputSchema extends z.ZodRawShape,
  TOutputSchema extends z.ZodRawShape | undefined
> = {
  name: string;
  title: string;
  description: string;
  inputSchema: TInputSchema;
  outputSchema?: TOutputSchema;
  callback: McpToolCallback<TInputSchema, TOutputSchema>;
};

export const createMcpTool = <
  TInputSchema extends z.ZodRawShape,
  TOutputSchema extends z.ZodRawShape | undefined
>(
  tool: McpTool<TInputSchema, TOutputSchema>
): McpTool<TInputSchema, TOutputSchema> => {
  return tool;
};
