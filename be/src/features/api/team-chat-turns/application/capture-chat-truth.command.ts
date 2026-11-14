import { Command } from "@nestjs/cqrs"
import type { CaptureOutcome } from "@modules/domain/team-chat-turns"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CaptureChatTruthRequest } from "./capture-chat-truth.contracts"

/** Files one message of the team chat as a truth change ("Ghi vao Second Brain"). */
export class CaptureChatTruthCommand extends Command<CaptureOutcome> {
    constructor(readonly params: ExecuteParams<CaptureChatTruthRequest>) {
        super()
    }
}
