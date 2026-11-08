import { QueryHandler } from "@nestjs/cqrs"
import { HiringInterviewsService, type PublicInterviewOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { PublicHiringInterviewQuery } from "./public-hiring-interview.query"

@QueryHandler(PublicHiringInterviewQuery)
/** Read an interview from the candidate's link. */
export class PublicHiringInterviewHandler extends ICQRSHandler<PublicHiringInterviewQuery, PublicInterviewOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly interviews: HiringInterviewsService,
    ) {
        super(logger)
    }

    protected override process(query: PublicHiringInterviewQuery): Promise<PublicInterviewOutput> {
        return this.interviews.publicView(query.params.request, query.params.request.credentialPrincipal)
    }
}
