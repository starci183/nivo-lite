import { QueryHandler } from "@nestjs/cqrs"
import { IdentitySessionsService } from "@modules/domain/identity"
import type { JwksDocument } from "@modules/integrations/passport"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetJwksQuery } from "./get-jwks.query"

@QueryHandler(GetJwksQuery)
/** Answers the JWKS. */
export class GetJwksHandler extends ICQRSHandler<GetJwksQuery, JwksDocument> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sessions: IdentitySessionsService,
    ) {
        super(logger)
    }

    protected override process(): Promise<JwksDocument> {
        return this.sessions.jwks()
    }
}
