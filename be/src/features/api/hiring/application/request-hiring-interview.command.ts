import { Command } from "@nestjs/cqrs"
import type { RequestInterviewOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestHiringInterviewRequest } from "./request-hiring-interview.contracts"

/** Asks for arrange an interview for a candidate. */
export class RequestHiringInterviewCommand extends Command<RequestInterviewOutput> {
    constructor(readonly params: ExecuteParams<RequestHiringInterviewRequest>) {
        super()
    }
}
