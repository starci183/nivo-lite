import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SuggestionContext, SuggestionDecision } from "./knowledge-suggestion-state.contracts"
import { KnowledgeSuggestionStateEntity } from "./persistence/entities"

/** Who may decide about the knowledge suggestions of a workspace. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** How many decisions one workspace's context reads. */
const DECISION_LIMIT = 200

/** The decision a stored row stands for; a row with another state is not a decision. */
const decisionOf = (row: KnowledgeSuggestionStateEntity): ReadonlyArray<SuggestionDecision> =>
    row.state === "dismissed" || row.state === "not_applicable" ? [{ key: row.suggestionKey, state: row.state }] : []

@Injectable()
/** What a workspace decided about the knowledge it is advised to add: dismissed, not applicable, or back on the list. */
export class KnowledgeSuggestionStateService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The decisions of the workspace with its business type; any member may read them. */
    async context(userId: string, workspaceId: string): Promise<SuggestionContext> {
        await this.members.require(userId, workspaceId)
        const [states, kind] = await Promise.all([
            this.entityManager.find(KnowledgeSuggestionStateEntity, {
                select: { suggestionKey: true, state: true },
                where: { workspaceId },
                take: DECISION_LIMIT,
            }),
            this.entityManager
                .createQueryBuilder()
                .select("w.business_type", "business_type")
                .from("public.workspaces", "w")
                .where("w.id = :workspaceId", { workspaceId })
                .limit(1)
                .getRawOne<{ business_type: string | null }>(),
        ])
        return { decisions: states.flatMap(decisionOf), businessType: kind?.business_type ?? null }
    }

    /** Marks a suggestion dismissed or not applicable; an absent state brings it back. Owners and managers only. */
    async decide(userId: string, workspaceId: string, key: string, state?: string): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGERS)
        if (state === undefined) {
            await this.entityManager.delete(KnowledgeSuggestionStateEntity, { workspaceId, suggestionKey: key })
            return
        }
        await this.entityManager.upsert(
            KnowledgeSuggestionStateEntity,
            { workspaceId, suggestionKey: key, state, decidedBy: userId, decidedAt: () => "now()" },
            ["workspaceId", "suggestionKey"],
        )
    }
}
