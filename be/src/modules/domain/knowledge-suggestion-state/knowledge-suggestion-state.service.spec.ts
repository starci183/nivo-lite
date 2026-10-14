import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { KnowledgeSuggestionStateService } from "./knowledge-suggestion-state.service"
import {
    DELETE_SUGGESTION_STATE,
    LIST_SUGGESTION_STATES,
    SELECT_BUSINESS_TYPE,
    UPSERT_SUGGESTION_STATE,
} from "./persistence/knowledge-suggestion-state.sql"

const member: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const build = async (stubs: ReadonlyArray<readonly [string, unknown]>) => {
    const em = mockEntityManager({ query: stubs })
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(member)
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSuggestionStateService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { state: moduleRef.get(KnowledgeSuggestionStateService), em, members }
}

describe("KnowledgeSuggestionStateService", () => {
    it("returns the decisions that are still a decision, and the business type", async () => {
        const { state } = await build([
            [
                LIST_SUGGESTION_STATES,
                [
                    { suggestion_key: "hours", state: "dismissed" },
                    { suggestion_key: "gone", state: "other" },
                ],
            ],
            [SELECT_BUSINESS_TYPE, [{ business_type: "cafe" }]],
        ])

        await expect(state.context("user-1", "ws-1")).resolves.toEqual({
            decisions: [{ key: "hours", state: "dismissed" }],
            businessType: "cafe",
        })
    })

    it("answers no business type when the workspace has none", async () => {
        const { state } = await build([
            [LIST_SUGGESTION_STATES, []],
            [SELECT_BUSINESS_TYPE, []],
        ])

        await expect(state.context("user-1", "ws-1")).resolves.toEqual({ decisions: [], businessType: null })
    })

    it("removes a decision when no state is given", async () => {
        const { state, em } = await build([[DELETE_SUGGESTION_STATE, []]])

        await expect(state.decide("user-1", "ws-1", "hours")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(DELETE_SUGGESTION_STATE, ["ws-1", "hours"])
    })

    it("stores a dismissal", async () => {
        const { state, em } = await build([[UPSERT_SUGGESTION_STATE, []]])

        await expect(state.decide("user-1", "ws-1", "hours", "dismissed")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(UPSERT_SUGGESTION_STATE, ["ws-1", "hours", "dismissed", "user-1"])
    })
})
