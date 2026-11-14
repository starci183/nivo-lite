import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { BrainTodoService } from "./brain-todo.service"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (role: WorkspaceRole) => {
    const members = mock<WorkspaceMembersService>()
    const facts = mock<BrainFactsReadService>()
    const gaps = mock<KnowledgeGapsService>()
    const documents = mock<PublicDocumentsService>()
    members.require.mockResolvedValue(mock<Awaited<ReturnType<WorkspaceMembersService["require"]>>>({ role }))
    facts.waitingCards.mockResolvedValue(3)
    gaps.countOpen.mockResolvedValue(2)
    documents.countProposals.mockResolvedValue(1)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainTodoService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BrainFactsReadService, useValue: facts },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: PublicDocumentsService, useValue: documents },
        ],
    }).compile()
    return { service: moduleRef.get(BrainTodoService), members, facts, gaps, documents }
}

describe("BrainTodoService count", () => {
    it.each(["owner", "manager"] as const)("sums fact cards, open questions and proposals for a %s", async (role) => {
        const { service, members } = await build(role)

        await expect(service.count("u1", WS)).resolves.toEqual({
            facts: 3,
            questions: 2,
            proposals: 1,
            total: 6,
        })

        expect(members.require).toHaveBeenCalledWith("u1", WS)
    })

    it("gives no inbox to a member who cannot see the facts or the questions", async () => {
        const { service, facts, gaps, documents } = await build("staff")

        await expect(service.count("u1", WS)).resolves.toEqual({
            facts: 0,
            questions: 0,
            proposals: 0,
            total: 0,
        })

        expect(facts.waitingCards).not.toHaveBeenCalled()
        expect(gaps.countOpen).not.toHaveBeenCalled()
        expect(documents.countProposals).not.toHaveBeenCalled()
    })

    it("refuses someone who is not a member of the workspace", async () => {
        const { service, members, facts } = await build("owner")
        members.require.mockRejectedValue(new Error("not a member"))

        await expect(service.count("u1", WS)).rejects.toThrow("not a member")

        expect(facts.waitingCards).not.toHaveBeenCalled()
    })
})
