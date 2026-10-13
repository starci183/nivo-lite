import { Query } from "@nestjs/cqrs"
import type { ContentFigures } from "@modules/domain/content-items"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetContentFiguresRequest } from "./content-figures.contracts"

/** The counts and next scheduled post of the content workbench. */
export class GetContentFiguresQuery extends Query<ContentFigures> {
    constructor(readonly params: ExecuteParams<GetContentFiguresRequest>) {
        super()
    }
}
