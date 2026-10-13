import { Command } from "@nestjs/cqrs"
import type { ContentBrandSettings } from "@modules/domain/content-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetContentAutomationRequest } from "./set-content-automation.contracts"

/** Requests setContentAutomation. */
export class SetContentAutomationCommand extends Command<ContentBrandSettings> {
    constructor(readonly params: ExecuteParams<SetContentAutomationRequest>) {
        super()
    }
}
