import { Command } from "@nestjs/cqrs"
import type { SavedContentRows } from "@modules/domain/content-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveContentCadenceRequest } from "./save-content-cadence.contracts"

/** Requests saveContentCadence. */
export class SaveContentCadenceCommand extends Command<SavedContentRows> {
    constructor(readonly params: ExecuteParams<SaveContentCadenceRequest>) {
        super()
    }
}
