declare module 'bun' {
  interface Env {
    DATABASE_URL: string;
    DATABASE_DIRECT_URL: string;
  }
}
