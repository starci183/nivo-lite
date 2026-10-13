import { QueryHandler } from "@nestjs/cqrs"
import { BrainPageService } from "@modules/domain/brain"
import type { LessonMiningState } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LessonMiningStatusQuery } from "./lesson-mining-status.query"

@QueryHandler(LessonMiningStatusQuery)
/** Reads where the study of an agent's corrections stands. */
export class LessonMiningStatusHandler extends ICQRSHandler<LessonMiningStatusQuery, LessonMiningState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: BrainPageService,
    ) {
        super(logger)
    }

    protected override process(query: LessonMiningStatusQuery): Promise<LessonMiningState> {
        return this.page.miningState(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.id,
        )
    }
}
