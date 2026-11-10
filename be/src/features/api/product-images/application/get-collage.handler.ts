import { QueryHandler } from "@nestjs/cqrs"
import { ChannelCollageService } from "@modules/domain/channels"
import type { StoredCollage } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetCollageQuery } from "./get-collage.query"

@QueryHandler(GetCollageQuery)
/** Runs get-collage through one call of the ChannelCollageService. */
export class GetCollageHandler extends ICQRSHandler<GetCollageQuery, StoredCollage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly collages: ChannelCollageService,
    ) {
        super(logger)
    }

    protected override process(query: GetCollageQuery): Promise<StoredCollage> {
        return this.collages.read(query.params.request.key)
    }
}
