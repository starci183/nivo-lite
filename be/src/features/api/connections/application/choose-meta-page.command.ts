import { Command } from "@nestjs/cqrs"
import type { MetaWizardConnection } from "@modules/domain/meta-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChooseMetaPageRequest } from "./choose-meta-page.contracts"

/** Chooses the Page of a Meta connection. */
export class ChooseMetaPageCommand extends Command<MetaWizardConnection> {
    constructor(readonly params: ExecuteParams<ChooseMetaPageRequest>) {
        super()
    }
}
