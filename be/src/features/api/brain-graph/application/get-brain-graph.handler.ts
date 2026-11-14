import { QueryHandler } from "@nestjs/cqrs"
import { BrainGraphService, type BrainGraph } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetBrainGraphQuery } from "./get-brain-graph.query"

@QueryHandler(GetBrainGraphQuery)
/** Reads one page of the truth graph. */
export class GetBrainGraphHandler extends ICQRSHandler<GetBrainGraphQuery, BrainGraph> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly graphs: BrainGraphService,
    ) {
        super(logger)
    }

    protected override process(query: GetBrainGraphQuery): Promise<BrainGraph> {
        return this.graphs.graph(query.params.principal.id, query.params.request)
    }
}
