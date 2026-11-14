import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { brainFactsEntities } from "@modules/domain/brain-facts"
import { SourceQuotaService } from "@modules/domain/knowledge-sources"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { TRUTH_CEILING, knowledgeUsageOf, roomOf, type KnowledgeUsageView, type TruthRoom, type TruthsInForce } from "./truth-ceiling.policy"

/** The entity of a truth. */
const [BrainFactEntity] = brainFactsEntities

/** What the count of the truths in force answers. */
interface HeldRow {
    readonly truths: string
    readonly bytes: string
}

/** The bytes of one truth's text, summed in the database: subject, attribute, value and unit in UTF-8. */
const BYTES =
    "COALESCE(SUM(octet_length(f.subjectLabel) + octet_length(f.attributeLabel) + octet_length(f.value) + COALESCE(octet_length(f.unit), 0)), 0)"

@Injectable()
/**
 * How much a business holds in force against its ceiling of truths (`truth-ceiling.policy.ts`): ONE aggregate over the truths in force
 * of the workspace (active and scheduled; read by `brain_facts_ws_status`), asked once per settle and once per documents page.
 */
export class TruthCeilingService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly quota: SourceQuotaService,
    ) {}

    /**
     * What the workspace holds of its two allowances, for one of its members: raw documents against its plan's storage, and truths in
     * force against their ceiling. The membership is proven by the first read; the count of truths follows it.
     */
    async usageOf(userId: string, workspaceId: string): Promise<KnowledgeUsageView> {
        const raw = await this.quota.usage(userId, workspaceId)
        return knowledgeUsageOf(raw, await this.held(workspaceId))
    }

    /** The truths in force of the workspace and their text in bytes. */
    async held(workspaceId: string): Promise<TruthsInForce> {
        const row = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .select("COUNT(*)", "truths")
            .addSelect(BYTES, "bytes")
            .where({ workspaceId, status: In(["active", "scheduled"]) })
            .getRawOne<HeldRow>()
        return { truths: Number(row?.truths ?? 0), bytes: Number(row?.bytes ?? 0) }
    }

    /** The room the workspace has left under the ceiling. */
    async room(workspaceId: string): Promise<TruthRoom> {
        return roomOf(await this.held(workspaceId), TRUTH_CEILING)
    }
}
