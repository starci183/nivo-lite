import { Command } from "@nestjs/cqrs"
import type { SavedContentRows } from "@modules/domain/content-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApplyContentCadencePresetsRequest } from "./apply-content-cadence-presets.contracts"

/** Requests applyContentCadencePresets. */
export class ApplyContentCadencePresetsCommand extends Command<SavedContentRows> {
    constructor(readonly params: ExecuteParams<ApplyContentCadencePresetsRequest>) {
        super()
    }
}
