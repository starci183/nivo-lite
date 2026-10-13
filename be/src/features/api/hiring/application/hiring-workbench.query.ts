import { Query } from "@nestjs/cqrs"
import type { HiringBenchView } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { HiringWorkbenchRequest } from "./hiring-workbench.contracts"

/** Asks for the whole hiring workbench of the caller's workspace. */
export class HiringWorkbenchQuery extends Query<HiringBenchView> {
    constructor(readonly params: ExecuteParams<HiringWorkbenchRequest>) {
        super()
    }
}
