import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchProject } from "@modules/domain/video"
import type { GetVideoProjectRequest } from "./get-video-project.contracts"

/** The authenticated videoProject operation. */
export class GetVideoProjectQuery extends Query<WorkbenchProject> {
    constructor(readonly params: ExecuteParams<GetVideoProjectRequest>) {
        super()
    }
}
