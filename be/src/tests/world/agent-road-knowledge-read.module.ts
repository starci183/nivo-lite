import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"

@Module({})
/** The documents of a workspace, read side only: what the probes of the clock need, with no storage and no index. */
export class KnowledgeReadModule {
    /** The read side of the documents alone: the probes of the clock read what changed, and need no storage or index. */
    static register(): DynamicModule {
        return {
            module: KnowledgeReadModule,
            global: true,
            providers: [KnowledgeSourcesReadService],
            exports: [KnowledgeSourcesReadService],
        }
    }
}
