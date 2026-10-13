import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SuggestionContext, SuggestionDecision } from "./knowledge-suggestion-state.contracts"
import type { BusinessTypeRow, SuggestionStateRow } from "./persistence/knowledge-suggestion-state.rows"
import {
    DELETE_SUGGESTION_STATE,
    LIST_SUGGESTION_STATES,
    SELECT_BUSINESS_TYPE,
    UPSERT_SUGGESTION_STATE,
} from "./persistence/knowledge-suggestion-state.sql"

/** Who may decide about the knowledge suggestions of a workspace. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The decision a stored row stands for; a row with another state is not a decision. */
const decisionOf = (row: SuggestionStateRow): ReadonlyArray<SuggestionDecision> =>
    row.state === "dismissed" || row.state === "not_applicable" ? [{ key: row.suggestion_key, state: row.state }] : []

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
        const [states, kinds] = await Promise.all([
            this.entityManager.query<Array<SuggestionStateRow>>(LIST_SUGGESTION_STATES, [workspaceId]),
            this.entityManager.query<Array<BusinessTypeRow>>(SELECT_BUSINESS_TYPE, [workspaceId]),
        ])
        return { decisions: states.flatMap(decisionOf), businessType: kinds[0]?.business_type ?? null }
    }

    /** Marks a suggestion dismissed or not applicable; an absent state brings it back. Owners and managers only. */
    async decide(userId: string, workspaceId: string, key: string, state?: string): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGERS)
        if (state === undefined) {
            await this.entityManager.query(DELETE_SUGGESTION_STATE, [workspaceId, key])
            return
        }
        await this.entityManager.query(UPSERT_SUGGESTION_STATE, [workspaceId, key, state, userId])
    }
}
