import { Command } from "@nestjs/cqrs"
import type { HiringInterviewsService, RespondSlotOutput } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

/** Asks for pick an interview time from the candidate's link. */
export class RespondHiringInterviewCommand extends Command<RespondSlotOutput> {
    constructor(readonly params: PublicExecuteParams<Parameters<HiringInterviewsService["respond"]>[0]>) {
        super()
    }
}
