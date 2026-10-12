import { DynamicModule, Logger, Module, OnModuleInit } from "@nestjs/common";
import { JobRegistry, type JobContext, type JobHandler } from "../../platform/pgmq";
import { FactsModel } from "./facts-model.service";
import { KNOWLEDGE_JOBS_OPTIONS, type KnowledgeJobsOptions } from "./knowledge-jobs.config";
import { KnowledgeJobsService } from "./knowledge-jobs.service";

/**
 * Heavy knowledge work as background jobs (pgmq queue 'knowledge', docs/JOBS.md):
 *   knowledge.index   { sourceId, workspaceId }   read (file in storage | link | Drive | text) -> chunk + embed -> enqueue knowledge.facts
 *   knowledge.facts   { sourceId, workspaceId }   read facts window by window into brain_facts (proposals, conflicts) -> ready
 *   knowledge.reembed { workspaceId, model? }     re-embed chunks made by another model
 * Registers one JobHandler per name with the platform's JobRegistry (global JobsModule). Needs the global SUPABASE client; the OpenClaw
 * gateway and the agent sync are looked up lazily for knowledge.facts.
 */
@Module({})
export class KnowledgeJobsModule implements OnModuleInit {
  private readonly log = new Logger(KnowledgeJobsModule.name);

  constructor(private readonly jobs: KnowledgeJobsService, private readonly registry: JobRegistry) {}

  static register(options: KnowledgeJobsOptions): DynamicModule {
    return {
      module: KnowledgeJobsModule,
      providers: [{ provide: KNOWLEDGE_JOBS_OPTIONS, useValue: options }, FactsModel, KnowledgeJobsService],
      exports: [KnowledgeJobsService],
    };
  }

  onModuleInit(): void {
    const handlers: [JobHandler<"knowledge.index">, JobHandler<"knowledge.facts">, JobHandler<"knowledge.reembed">] = [
      { name: "knowledge.index", handle: (ctx: JobContext<"knowledge.index">) => this.jobs.index(ctx) },
      { name: "knowledge.facts", handle: (ctx: JobContext<"knowledge.facts">) => this.jobs.facts(ctx) },
      { name: "knowledge.reembed", handle: (ctx: JobContext<"knowledge.reembed">) => this.jobs.reembed(ctx) },
    ];
    for (const h of handlers) this.registry.register(h);
    this.log.log(`registered ${handlers.map((h) => h.name).join(", ")}`);
  }
}
