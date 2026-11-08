import { CommandHandler } from "@nestjs/cqrs"
import { VideoProjectEditorService, type BrandKit } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SaveVideoBrandCommand } from "./save-video-brand.command"

@CommandHandler(SaveVideoBrandCommand)
/** Dispatches saveVideoBrand through its checked domain use case. */
export class SaveVideoBrandHandler extends ICQRSHandler<SaveVideoBrandCommand, BrandKit> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoProjectEditorService,
    ) {
        super(logger)
    }

    protected override process(operation: SaveVideoBrandCommand): Promise<BrandKit> {
        return this.service.saveBrand(
            operation.params.principal.id,
            operation.params.request.workspaceId,
            operation.params.request,
        )
    }
}
