import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { WorkspaceMembersService, type WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { DocumentNatureAnswerService } from "./document-nature-answer.service"
import { DocumentPartsService } from "./document-parts.service"
import { FOUNDER } from "./founder.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = new Date("2026-11-12T05:00:00.000Z")

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const queue = mock<KnowledgeQueue>()
    const extractions = mock<BrainExtractionsService>()
    const parts = mock<DocumentPartsService>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(mock<WorkspaceMember>({ displayName: "Owner" }))
    parts.wholeOf.mockResolvedValue(["p1", "p2"])
    extractions.overrideNature.mockResolvedValue(["p1", "p2"])
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentNatureAnswerService,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: KnowledgeQueue, useValue: queue },
            { provide: BrainExtractionsService, useValue: extractions },
            { provide: DocumentPartsService, useValue: parts },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(DocumentNatureAnswerService), tx, queue, extractions, members }
}

describe("DocumentNatureAnswerService: the founder says what a document is", () => {
    it("saves his answer on every part, opens their readings at triage and queues their jobs in one transaction", async () => {
        const t = await build()

        await expect(t.service.answer("u1", WS, "p2", "reference")).resolves.toEqual({ id: "p2", parts: ["p1", "p2"], reopened: 2 })

        expect(t.members.require).toHaveBeenCalledWith("u1", WS, FOUNDER)
        expect(t.extractions.overrideNature).toHaveBeenCalledWith(
            WS,
            ["p1", "p2"],
            { nature: "reference", by: "Owner", at: AT.toISOString() },
            expect.anything(),
        )
        expect(t.queue.enqueueFactsNext).toHaveBeenCalledWith({ sourceId: "p1", workspaceId: WS }, expect.anything(), `nature:${AT.toISOString()}`)
        expect(t.queue.enqueueFactsNext).toHaveBeenCalledTimes(2)
        expect(t.tx.outcomes).toEqual(["commit"])
    })

    it("no answer takes his answer back; anyone but the founder is refused before anything is written", async () => {
        const t = await build()
        await t.service.answer("u1", WS, "p1", undefined)
        expect(t.extractions.overrideNature).toHaveBeenCalledWith(WS, ["p1", "p2"], null, expect.anything())

        const u = await build()
        u.members.require.mockRejectedValue(new Error("not the founder"))
        await expect(u.service.answer("u2", WS, "p1", "rules")).rejects.toThrow("not the founder")
        expect(u.extractions.overrideNature).not.toHaveBeenCalled()
    })
})
