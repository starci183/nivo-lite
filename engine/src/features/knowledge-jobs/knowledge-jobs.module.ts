import { DynamicModule, Inject, Logger, Module, OnModuleInit, Optional } from "@nestjs/common";
import { FactsModel } from "./facts-model.service";
import { JOB_REGISTRY, KNOWLEDGE_JOBS, type JobRegistry } from "./job-registry.port";
import { KNOWLEDGE_JOBS_OPTIONS, type KnowledgeJobsOptions } from "./knowledge-jobs.config";
import { KnowledgeJobsService } from "./knowledge-jobs.service";

/**
 * Heavy knowledge work as BullMQ jobs (queue 'knowledge'):
 *   knowledge.index   { sourceId, workspaceId }   read (file in storage | link | Drive | text) -> chunk + embed -> enqueue knowledge.facts
 *   knowledge.facts   { sourceId, workspaceId }   read facts window by window into brain_facts (proposals, conflicts) -> ready
 *   knowledge.reembed { workspaceId, model? }     re-embed chunks made by another model
 * Registers one handler per name with the platform's worker registry (JOB_REGISTRY). Needs the global SUPABASE client; the OpenClaw gateway and
 * the agent sync are looked up lazily for knowledge.facts.
 */
@Module({})
export class KnowledgeJobsModule implements OnModuleInit {
  private readonly log = new Logger(KnowledgeJobsModule.name);

  constructor(private readonly jobs: KnowledgeJobsService, @Optional() @Inject(JOB_REGISTRY) private readonly registry?: JobRegistry) {}

  static register(options: KnowledgeJobsOptions): DynamicModule {
    return {
      module: KnowledgeJobsModule,
      providers: [{ provide: KNOWLEDGE_JOBS_OPTIONS, useValue: options }, FactsModel, KnowledgeJobsService],
      exports: [KnowledgeJobsService],
    };
  }

  onModuleInit(): void {
    if (!this.registry) {
      this.log.warn("no BullMQ job registry (JOB_REGISTRY): knowledge.index / knowledge.facts / knowledge.reembed are not consumed by this engine");
      return;
    }
    this.registry.register(KNOWLEDGE_JOBS.index, (job) => this.jobs.index(job));
    this.registry.register(KNOWLEDGE_JOBS.facts, (job) => this.jobs.facts(job));
    this.registry.register(KNOWLEDGE_JOBS.reembed, (job) => this.jobs.reembed(job));
    this.log.log(`registered ${Object.values(KNOWLEDGE_JOBS).join(", ")}`);
  }
}
