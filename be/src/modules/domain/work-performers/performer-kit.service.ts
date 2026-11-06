import { Injectable } from "@nestjs/common"
import type { WorkContext } from "@modules/domain/decisions"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"

@Injectable()
/** What every performer reaches for: its texts in the language of the call. */
export class PerformerKitService {
    constructor(@InjectMessageCatalog() private readonly catalog: MessageCatalog) {}

    /** A performer text in the language of the call. */
    text(ctx: WorkContext, key: string, params: Readonly<Record<string, string | number>> = {}): string {
        return this.catalog.get(`performers.${key}`, params, ctx.locale)
    }
}
