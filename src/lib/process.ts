import { join } from 'path';
import { mkdirSync, appendFileSync, existsSync } from 'fs';
import consola from 'consola';
import type { Service } from '../types/config';

const COLORS: Record<string, string> = {
  api: '\x1b[36m',
  ui: '\x1b[35m',
  web: '\x1b[33m',
  worker: '\x1b[32m',
};

const RESET = '\x1b[0m';

interface RunningProcess {
  proc: ReturnType<typeof Bun.spawn>;
  name: string;
}

export async function runHook(worktreePath: string, command: string): Promise<void> {
  const [cmd, ...args] = command.split(' ');
  const proc = Bun.spawn([cmd, ...args], {
    cwd: worktreePath,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Hook failed: ${command} (exit code ${exitCode})`);
  }
}

export async function runServiceHooks(
  worktreePath: string,
  service: Service,
): Promise<void> {
  if (!service.pre_hooks?.length) return;

  const cwd = join(worktreePath, service.working_dir);
  for (const hook of service.pre_hooks) {
    consola.info(`Running pre-hook for ${service.name}: ${hook}`);
    await runHook(cwd, hook);
  }
}

export function startService(
  worktreePath: string,
  service: Service,
  logsDir: string,
): RunningProcess {
  const cwd = join(worktreePath, service.working_dir);
  const logFile = join(logsDir, `${service.name}.log`);
  const color = COLORS[service.name] ?? '\x1b[37m';
  const prefix = `${color}[${service.name.toUpperCase()}]${RESET}`;

  mkdirSync(logsDir, { recursive: true });
  appendFileSync(logFile, `\n--- Session started: ${new Date().toISOString()} ---\n`);

  const [cmd, ...args] = service.command.split(' ');
  const proc = Bun.spawn([cmd, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  streamOutput(proc.stdout, prefix, logFile);
  streamOutput(proc.stderr, prefix, logFile);

  return { proc, name: service.name };
}

async function streamOutput(
  stream: ReadableStream<Uint8Array>,
  prefix: string,
  logFile: string,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const timestamp = new Date().toISOString();

      for (const line of text.split('\n').filter(Boolean)) {
        process.stdout.write(`${prefix} ${line}\n`);
        appendFileSync(logFile, `[${timestamp}] ${line}\n`);
      }
    }
  } catch {
    // stream closed
  }
}

export function setupShutdownHandler(
  processes: RunningProcess[],
  logsDir: string,
): void {
  const cleanup = () => {
    consola.info('Shutting down services...');
    for (const { proc, name } of processes) {
      proc.kill();
      const logFile = join(logsDir, `${name}.log`);
      appendFileSync(logFile, `--- Session ended: ${new Date().toISOString()} ---\n`);
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
