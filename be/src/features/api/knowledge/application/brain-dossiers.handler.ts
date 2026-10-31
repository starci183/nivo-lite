import { QueryHandler } from "@nestjs/cqrs"
import { BrainDossiersService } from "@modules/domain/brain-dossiers"
import type { DossierRecord } from "@modules/domain/brain-dossiers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainDossiersQuery } from "./brain-dossiers.query"

@QueryHandler(BrainDossiersQuery)
/** Lists the dossiers the workspace tracks by category, each with its status and the documents that name it. */
export class BrainDossiersHandler extends ICQRSHandler<BrainDossiersQuery, ReadonlyArray<DossierRecord>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly dossiers: BrainDossiersService,
    ) {
        super(logger)
    }

    protected override process(query: BrainDossiersQuery): Promise<ReadonlyArray<DossierRecord>> {
        return this.dossiers.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
