import "reflect-metadata";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule, type AppOptions } from "./app.module";
import { parseKnowledgeJobsConfig } from "./features/knowledge-jobs/knowledge-jobs.config";
import { parseN8nConfig } from "./features/n8n-emit/n8n.config";
import { parseJobsConfig } from "./platform/pgmq/jobs.config";
import { ConfigError, EnvSource } from "./platform/config/env.source";
import { parseHttpConfig } from "./platform/config/http.config";
import { parseNivoConfig } from "./platform/nivo/nivo.config";
import { parseOpenclawConfig } from "./platform/openclaw/openclaw.config";
import { parseQueueConfig } from "./platform/queue/queue.config";
import { parseSupabaseConfig } from "./platform/supabase/supabase.module";

const version = (): string => {
  try {
    return (JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
};

/** Validate every setting BEFORE any listener, worker or outbound call exists. A bad setting names its key and never prints a value. */
const parseOptions = (env: EnvSource): AppOptions => ({
  supabase: parseSupabaseConfig(env),
  queue: parseQueueConfig(env, version()),
  jobs: parseJobsConfig(env),
  nivo: parseNivoConfig(env),
  openclaw: parseOpenclawConfig(env),
  n8n: parseN8nConfig(env),
  http: parseHttpConfig(env),
  knowledge: parseKnowledgeJobsConfig(env),
});

async function bootstrap(): Promise<void> {
  const log = new Logger("engine");
  let options: AppOptions;
  try {
    options = parseOptions(EnvSource.fromProcess());
  } catch (e) {
    log.error(e instanceof ConfigError ? `configuration error: ${e.message}` : "configuration error");
    process.exit(1);
  }
  const app = await NestFactory.create(AppModule.register(options), { logger: ["log", "warn", "error"] });
  app.enableShutdownHooks();
  await app.listen(options.http.port, options.http.host);
  log.log(`engine ${options.queue.version} listening on ${options.http.host}:${options.http.port}; OpenClaw ${options.openclaw.gateway ? "configured" : "NOT configured (chat.turn uses the direct fallback)"}; pgmq jobs ${options.jobs.enabled ? "on" : "OFF (JOBS_ENABLED=0: jobs wait in their queue)"}; engine_jobs worker ${options.queue.enabled ? "on" : "OFF (ENGINE_WORKER_ENABLED=0)"}`);
}

void bootstrap();
