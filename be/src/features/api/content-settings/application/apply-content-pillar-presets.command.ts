import { Command } from "@nestjs/cqrs"
import type { SavedContentRows } from "@modules/domain/content-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApplyContentPillarPresetsRequest } from "./apply-content-pillar-presets.contracts"

/** Requests applyContentPillarPresets. */
export class ApplyContentPillarPresetsCommand extends Command<SavedContentRows> {
    constructor(readonly params: ExecuteParams<ApplyContentPillarPresetsRequest>) {
        super()
    }
}
