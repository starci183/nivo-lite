import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BrandKit } from "@modules/domain/video"
import type { SaveVideoBrandRequest } from "./save-video-brand.contracts"

/** The authenticated saveVideoBrand operation. */
export class SaveVideoBrandCommand extends Command<BrandKit> {
    constructor(readonly params: ExecuteParams<SaveVideoBrandRequest>) {
        super()
    }
}
