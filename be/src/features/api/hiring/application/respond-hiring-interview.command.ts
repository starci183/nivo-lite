import type { HiringLinkRequest } from "./hiring-link.contracts"
import { Command } from "@nestjs/cqrs"
import type { HiringInterviewsService } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

type RespondSlotOutput = Awaited<ReturnType<HiringInterviewsService["respond"]>>

/** Asks for pick an interview time from the candidate's link. */
export class RespondHiringInterviewCommand extends Command<RespondSlotOutput> {
    constructor(
        readonly params: PublicExecuteParams<HiringLinkRequest<Parameters<HiringInterviewsService["respond"]>[0]>>,
    ) {
        super()
    }
}
