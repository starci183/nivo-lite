import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { expressionValues } from "@tests/fixtures/builders/sql-expression.builder"
import { KnowledgeSuggestionStateService } from "./knowledge-suggestion-state.service"
import { KnowledgeSuggestionStateEntity } from "./persistence/entities"

const member: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const stateOf = (suggestionKey: string, state: string) =>
    Object.assign(new KnowledgeSuggestionStateEntity(), { suggestionKey, state })

const build = async (em: MockEntityManager, businessType?: string | null) => {
    const fake = fakeQueryBuilder({
        getRawOne: businessType === undefined ? undefined : { business_type: businessType },
    })
    em.createQueryBuilder.mockReturnValue(fake.builder as never)
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(member)
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSuggestionStateService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { state: moduleRef.get(KnowledgeSuggestionStateService), em, fake }
}

describe("KnowledgeSuggestionStateService", () => {
    it("returns the decisions that are still a decision, and the business type", async () => {
        const { state, em, fake } = await build(
            mockEntityManager({
                find: [KnowledgeSuggestionStateEntity, [stateOf("hours", "dismissed"), stateOf("gone", "other")]],
            }),
            "cafe",
        )

        await expect(state.context("user-1", "ws-1")).resolves.toEqual({
            decisions: [{ key: "hours", state: "dismissed" }],
            businessType: "cafe",
        })
        expect(em.find).toHaveBeenCalledWith(KnowledgeSuggestionStateEntity, {
            select: { suggestionKey: true, state: true },
            where: { workspaceId: "ws-1" },
            take: 200,
        })
        expect(fake.callsOf("from")).toEqual([["public.workspaces", "w"]])
    })

    it("answers no business type when the workspace has none", async () => {
        const { state } = await build(mockEntityManager({ find: [KnowledgeSuggestionStateEntity, []] }))

        await expect(state.context("user-1", "ws-1")).resolves.toEqual({ decisions: [], businessType: null })
    })

    it("removes a decision when no state is given", async () => {
        const { state, em } = await build(
            mockEntityManager({ delete: [KnowledgeSuggestionStateEntity, { affected: 1 }] }),
        )

        await expect(state.decide("user-1", "ws-1", "hours")).resolves.toBeUndefined()
        expect(em.delete).toHaveBeenCalledWith(KnowledgeSuggestionStateEntity, {
            workspaceId: "ws-1",
            suggestionKey: "hours",
        })
    })

    it("stores a dismissal", async () => {
        const { state, em } = await build(mockEntityManager({ upsert: [KnowledgeSuggestionStateEntity, {}] }))

        await expect(state.decide("user-1", "ws-1", "hours", "dismissed")).resolves.toBeUndefined()
        const [target, row, keys] = em.upsert.mock.calls[0] ?? []
        expect(target).toBe(KnowledgeSuggestionStateEntity)
        expect(expressionValues(row)).toEqual({
            workspaceId: "ws-1",
            suggestionKey: "hours",
            state: "dismissed",
            decidedBy: "user-1",
            decidedAt: "now()",
        })
        expect(keys).toEqual(["workspaceId", "suggestionKey"])
    })
})
