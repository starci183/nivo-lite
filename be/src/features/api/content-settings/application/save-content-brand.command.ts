import { Command } from "@nestjs/cqrs"
import type { ContentBrandSettings } from "@modules/domain/content-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveContentBrandRequest } from "./save-content-brand.contracts"

/** Requests saveContentBrand. */
export class SaveContentBrandCommand extends Command<ContentBrandSettings> {
    constructor(readonly params: ExecuteParams<SaveContentBrandRequest>) {
        super()
    }
}
