import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchFigures } from "@modules/domain/video"
import type { GetVideoFiguresRequest } from "./get-video-figures.contracts"

/** The authenticated videoFigures operation. */
export class GetVideoFiguresQuery extends Query<WorkbenchFigures> {
    constructor(readonly params: ExecuteParams<GetVideoFiguresRequest>) {
        super()
    }
}
