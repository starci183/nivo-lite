import { QueryHandler } from "@nestjs/cqrs"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { NivoKnowledgeCountQuery } from "./nivo-knowledge-count.query"

@QueryHandler(NivoKnowledgeCountQuery)
/** Counts the base knowledge of the module and of the shared core. */
export class NivoKnowledgeCountHandler extends ICQRSHandler<NivoKnowledgeCountQuery, number> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly nivo: NivoKnowledgeService,
    ) {
        super(logger)
    }

    protected override process(query: NivoKnowledgeCountQuery): Promise<number> {
        return this.nivo.countForModule(query.params.request.module)
    }
}
