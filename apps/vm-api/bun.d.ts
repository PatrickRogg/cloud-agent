declare module 'bun' {
  interface Env {
    API_KEY: string;
    WORKING_DIRECTORY: string;
    ANTHROPIC_API_KEY: string;
    CLAUDE_CODE_OAUTH_TOKEN: string;
    PATH_TO_CLAUDE_CODE_EXECUTABLE: string;
    PORT: string;
  }
}
