import z from 'zod';
import { cloudProviderEnum } from './vm';

export const cloudProviderConfigSchema = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('hetzner'),
    config: z.object({
      token: z.string().min(1, 'Hetzner API token is required')
    })
  })
]);

export const vmInstanceConfigSchema = z.object({
  provider: cloudProviderEnum,
  name: z.string().min(1, 'Name is required'),
  region: z.string().min(1, 'Region is required'),
  instanceType: z.string().min(1, 'Instance type is required')
});

export const vmConfigSchema = z.object({
  sshKey: z.string().min(1, 'Path to SSH private key is required'),
  apiKey: z.string().min(1, 'API key is required'),
  providers: cloudProviderConfigSchema.array(),
  instances: z.array(vmInstanceConfigSchema)
});

const authConfigSchema = z.object({
  anthropic: z.union([
    z
      .object({
        apiKey: z.string().min(1, 'Claude Code API key is required').optional(),
        claudeDirectory: z
          .string()
          .min(1, 'Claude directory is required. Usually ~/.claude')
          .optional()
      })
      .refine(data => data.apiKey  || data.claudeDirectory, {
        message: 'Either API key, or Claude directory is required'
      })
      .refine(data => [data.apiKey, data.claudeDirectory].filter(Boolean).length === 1, {
        message: 'Only one of API key, or Claude directory is allowed'
      })
  ])
});

export const configSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  vm: vmConfigSchema,
  auth: authConfigSchema
});

export type AuthConfig = z.infer<typeof authConfigSchema>;
export type CloudProviderConfig = z.infer<typeof cloudProviderConfigSchema>;
export type VmInstanceConfig = z.infer<typeof vmInstanceConfigSchema>;
export type VmConfig = z.infer<typeof vmConfigSchema>;
export type Config = z.infer<typeof configSchema>;
