import { QueryHandler } from "@nestjs/cqrs"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import type { NivoEntry } from "@modules/domain/nivo-knowledge"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { NivoKnowledgeQuery } from "./nivo-knowledge.query"

@QueryHandler(NivoKnowledgeQuery)
/** Lists the base knowledge of NIVO, which every signed-in person may read. */
export class NivoKnowledgeHandler extends ICQRSHandler<NivoKnowledgeQuery, ReadonlyArray<NivoEntry>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly nivo: NivoKnowledgeService,
    ) {
        super(logger)
    }

    protected override process(): Promise<ReadonlyArray<NivoEntry>> {
        return this.nivo.list()
    }
}
