import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { INSERT_EVAL_CASES } from "./persistence/brain-eval-cases.sql"

/** One known-good answer to keep: an owner's correction of an agent's draft. */
export interface EvalCaseDraft {
    /** Where the case came from, e.g. `decision:<id>`; a case is kept once per origin. */
    readonly originRef: string
    /** What the agent was given. */
    readonly input: object
    /** What the owner wanted. */
    readonly expected: object
}

@Injectable()
/** Known-good answers kept as regression cases: a correction becomes a case a later change can be checked against. */
export class BrainEvalCasesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Keeps each case once; answers how many were new. */
    async keep(workspaceId: string, module: string, cases: ReadonlyArray<EvalCaseDraft>): Promise<number> {
        if (cases.length === 0) return 0
        const rows = await this.entityManager.query<Array<{ id: string }>>(INSERT_EVAL_CASES, [
            workspaceId,
            module,
            cases.map((item) => item.originRef),
            cases.map((item) => JSON.stringify(item.input)),
            cases.map((item) => JSON.stringify(item.expected)),
        ])
        return rows.length
    }
}
