import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { BrainEvalCaseEntity } from "./persistence/entities"

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
        const known = await this.entityManager.find(BrainEvalCaseEntity, {
            select: { originRef: true },
            where: { workspaceId, originRef: In(cases.map((item) => item.originRef)) },
            take: cases.length,
        })
        const kept = new Set(known.map((item) => item.originRef))
        const fresh = cases.filter((item) => !kept.has(item.originRef))
        if (fresh.length === 0) return 0
        const inserted = await this.entityManager.insert(
            BrainEvalCaseEntity,
            fresh.map((item) => ({
                workspaceId,
                module,
                kind: "draft" as const,
                input: item.input,
                expected: item.expected,
                originRef: item.originRef,
            })),
        )
        return inserted.identifiers.length
    }
}
