export type Agent = {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentConfig = {
  name: string;
  systemPrompt: string;
};
