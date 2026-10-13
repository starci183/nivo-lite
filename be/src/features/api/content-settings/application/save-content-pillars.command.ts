import { Command } from "@nestjs/cqrs"
import type { SavedContentRows } from "@modules/domain/content-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveContentPillarsRequest } from "./save-content-pillars.contracts"

/** Requests saveContentPillars. */
export class SaveContentPillarsCommand extends Command<SavedContentRows> {
    constructor(readonly params: ExecuteParams<SaveContentPillarsRequest>) {
        super()
    }
}
