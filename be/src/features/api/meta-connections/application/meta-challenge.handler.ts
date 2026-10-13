import { QueryHandler } from "@nestjs/cqrs"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MetaChallengeResult } from "./meta-challenge.contracts"
import { MetaChallengeQuery } from "./meta-challenge.query"

@QueryHandler(MetaChallengeQuery)
/** Echoes the hub challenge when the request carries our verify token. */
export class MetaChallengeHandler extends ICQRSHandler<MetaChallengeQuery, MetaChallengeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly metaConnectionsService: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: MetaChallengeQuery): Promise<MetaChallengeResult> {
        return Promise.resolve(this.metaConnectionsService.answerChallenge(query.params.request))
    }
}
