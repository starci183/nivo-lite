import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChooseMetaPageRequest, ChooseMetaPageResult } from "./choose-meta-page.contracts"

/** Chooses the Page of a Meta connection. */
export class ChooseMetaPageCommand extends Command<ChooseMetaPageResult> {
    constructor(readonly params: ExecuteParams<ChooseMetaPageRequest>) {
        super()
    }
}
