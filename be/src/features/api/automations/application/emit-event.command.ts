import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { EmitEventRequest, EmitEventResult } from "./emit-event.contracts"

/** Tells the engine a business event happened. */
export class EmitEventCommand extends Command<EmitEventResult> {
    constructor(readonly params: ExecuteParams<EmitEventRequest>) {
        super()
    }
}
