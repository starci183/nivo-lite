import { QueryHandler } from "@nestjs/cqrs"
import { GenerationsService, type GenerationStatus } from "@modules/domain/ai-generations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetGenerationStatusQuery } from "./get-generation-status.query"

@QueryHandler(GetGenerationStatusQuery)
/** Answers the status of a queued text from the generations service. */
export class GetGenerationStatusHandler extends ICQRSHandler<GetGenerationStatusQuery, GenerationStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly generations: GenerationsService,
    ) {
        super(logger)
    }

    protected override process(query: GetGenerationStatusQuery): Promise<GenerationStatus> {
        return this.generations.statusFor(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.generationId,
        )
    }
}
