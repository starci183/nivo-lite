import { Command } from "@nestjs/cqrs"
import type { RespondSlotOutput } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RespondHiringInterviewRequest } from "./respond-hiring-interview.contracts"

/** Asks for pick an interview time from the candidate's link. */
export class RespondHiringInterviewCommand extends Command<RespondSlotOutput> {
    constructor(readonly params: PublicExecuteParams<RespondHiringInterviewRequest>) {
        super()
    }
}
