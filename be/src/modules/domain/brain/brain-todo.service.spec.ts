import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { BrainTodoService } from "./brain-todo.service"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (role: WorkspaceRole) => {
    const members = mock<WorkspaceMembersService>()
    const facts = mock<BrainFactsReadService>()
    const gaps = mock<KnowledgeGapsService>()
    const findings = mock<DossierFindingsService>()
    members.require.mockResolvedValue(mock<Awaited<ReturnType<WorkspaceMembersService["require"]>>>({ role }))
    findings.activeCount.mockResolvedValue(4)
    facts.waitingCards.mockResolvedValue(3)
    gaps.countOpen.mockResolvedValue(2)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainTodoService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BrainFactsReadService, useValue: facts },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: DossierFindingsService, useValue: findings },
        ],
    }).compile()
    return { service: moduleRef.get(BrainTodoService), members, facts, gaps, findings }
}

describe("BrainTodoService count", () => {
    it.each(["owner", "manager"] as const)("sums findings, fact cards and open questions for a %s", async (role) => {
        const { service, members } = await build(role)

        await expect(service.count("u1", WS)).resolves.toEqual({ findings: 4, facts: 3, questions: 2, total: 9 })

        expect(members.require).toHaveBeenCalledWith("u1", WS)
    })

    it("counts the findings alone for a member who cannot see the facts or the questions", async () => {
        const { service, facts, gaps } = await build("staff")

        await expect(service.count("u1", WS)).resolves.toEqual({ findings: 4, facts: 0, questions: 0, total: 4 })

        expect(facts.waitingCards).not.toHaveBeenCalled()
        expect(gaps.countOpen).not.toHaveBeenCalled()
    })

    it("refuses someone who is not a member of the workspace", async () => {
        const { service, members, findings } = await build("owner")
        members.require.mockRejectedValue(new Error("not a member"))

        await expect(service.count("u1", WS)).rejects.toThrow("not a member")

        expect(findings.activeCount).not.toHaveBeenCalled()
    })
})
