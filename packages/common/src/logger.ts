/**
 * Simple logger utility
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export class ConsoleLogger implements Logger {
  constructor(
    private level: LogLevel = 'info',
    private withPrefix: boolean = false
  ) {}

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      if (this.withPrefix) {
        message = `[DEBUG] ${message}`;
      }
      console.debug(message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      if (this.withPrefix) {
        message = `[INFO] ${message}`;
      }
      console.info(message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      if (this.withPrefix) {
        message = `[WARN] ${message}`;
      }
      console.warn(message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      if (this.withPrefix) {
        message = `[ERROR] ${message}`;
      }
      console.error(message, ...args);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

export const logger = new ConsoleLogger();
