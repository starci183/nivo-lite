import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { DocumentCritiqueAnswersService } from "./document-critique-answers.service"
import { DocumentCritiqueReadService } from "./document-critique-read.service"
import type { CritiquePointView } from "./document-critique-read.service"
import { DossierReviewRunsService } from "./dossier-review-runs.service"
import { DossierReviewErrorCode } from "./errors/dossier-review.error"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"

const WS = "11111111-1111-4111-8111-111111111111"
const OWNER = "owner-1"

const pointOf = (over: Partial<CritiquePointView> = {}): CritiquePointView => ({
    id: "p1",
    sourceId: "s1",
    group: "inside",
    kind: "inside_contradiction",
    severity: "high",
    origin: "rule",
    line: "Hai doan trong file noi khac nhau: Phi giao hang noi thanh",
    why: "Mot cho ghi 30.000 d, cho khac ghi 25.000 d.",
    question: "Phi giao hang noi thanh la bao nhieu?",
    quotes: [],
    against: null,
    choices: [
        { id: "a", label: "30.000 d", needsInput: false, inputHint: null, answer: { kind: "pick", factId: "f30", value: "30.000 d" } },
        { id: "b", label: "25.000 d", needsInput: false, inputHint: null, answer: { kind: "pick", factId: "f25", value: "25.000 d" } },
    ],
    state: "open",
    answer: null,
    proposalFactId: null,
    decidedAt: null,
    firstSeenAt: "2026-11-11T10:00:00.000Z",
    factIds: ["f25", "f30"],
    target: null,
    ...over,
})

const factOf = (id: string, value: string, status: FactRecord["status"] = "proposed"): FactRecord =>
    ({ id, subjectKey: "giao-hang-noi-thanh", attribute: "phi-giao-hang", subjectLabel: "Giao hang noi thanh", attributeLabel: "Phi giao hang", value, status, scope: "public", installationId: null }) as FactRecord

const build = async (point: CritiquePointView, role: "owner" | "manager" = "owner") => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockImplementation((_user, _ws, roles) =>
        roles !== undefined && !roles.includes(role) ? Promise.reject(new Error("WORKSPACE_MEMBERS_ROLE_FORBIDDEN")) : Promise.resolve({ role, displayName: "Founder" } as never),
    )
    const critique = mock<DocumentCritiqueReadService>()
    critique.point.mockResolvedValue({ row: {} as never, view: point })
    const facts = mock<BrainFactsService>()
    facts.reject.mockResolvedValue({} as FactRecord)
    facts.propose.mockResolvedValue({ fact: factOf("f-new", "20.000 d"), outcome: "proposed" })
    const reads = mock<BrainFactsReadService>()
    reads.byIds.mockResolvedValue([factOf("f30", "30.000 d"), factOf("f25", "25.000 d")])
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentCritiqueAnswersService,
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => key) }) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: DocumentCritiqueReadService, useValue: critique },
            { provide: DossierReviewRunsService, useValue: mock<DossierReviewRunsService>() },
            { provide: BrainFactsService, useValue: facts },
            { provide: BrainFactsReadService, useValue: reads },
        ],
    }).compile()
    return { service: moduleRef.get(DocumentCritiqueAnswersService), critique, facts }
}

describe("DocumentCritiqueAnswersService", () => {
    it("pick: the chosen value stays a WAITING proposal, the competing one is turned down through the founder decision path; nothing is applied", async () => {
        const { service, critique, facts } = await build(pointOf())
        await service.answer(OWNER, { workspaceId: WS, findingId: "p1", choiceId: "a" })
        expect(facts.reject).toHaveBeenCalledTimes(1)
        expect(facts.reject).toHaveBeenCalledWith(WS, "f25", "Founder", "critic.answer.reject_note")
        expect(facts.apply).not.toHaveBeenCalled()
        expect(facts.propose).not.toHaveBeenCalled()
        expect(critique.recordAnswer).toHaveBeenCalledWith(WS, "p1", {
            answer: { kind: "pick", factId: "f30", value: "30.000 d" },
            proposalFactId: "f30",
            by: OWNER,
            note: null,
        })
    })

    it("value on a vague rule: the typed amount is filed as a new proposal (owner source, never auto-applied) under the point's target", async () => {
        const vague = pointOf({
            group: "unclear",
            kind: "vague",
            factIds: [],
            choices: [{ id: "a", label: "Dien muc cu the", needsInput: true, inputHint: "?", answer: { kind: "value", factId: null, value: null } }],
            target: { subjectLabel: "Giao nhanh", attributeLabel: "Muc tinh them" },
        })
        const { service, facts } = await build(vague)
        await expect(service.answer(OWNER, { workspaceId: WS, findingId: "p1", choiceId: "a" })).rejects.toMatchObject({
            code: DossierReviewErrorCode.CriticAnswerInvalid,
        })
        await service.answer(OWNER, { workspaceId: WS, findingId: "p1", choiceId: "a", value: "20.000 d moi don" })
        expect(facts.propose).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({ subjectLabel: "Giao nhanh", attributeLabel: "Muc tinh them", value: "20.000 d moi don", sourceKind: "owner", autoApply: false }),
        )
        expect(facts.reject).not.toHaveBeenCalled()
    })

    it("only the founder answers; a manager may skip; a decided point refuses a second answer", async () => {
        const manager = await build(pointOf(), "manager")
        await expect(manager.service.answer("m1", { workspaceId: WS, findingId: "p1", choiceId: "a" })).rejects.toThrow("WORKSPACE_MEMBERS_ROLE_FORBIDDEN")
        await manager.service.skip("m1", WS, "p1", undefined)
        expect(manager.critique.skip).toHaveBeenCalledWith(WS, "p1", "m1", "critic.answer.skip")
        const decided = await build(pointOf({ state: "answered" }))
        await expect(decided.service.answer(OWNER, { workspaceId: WS, findingId: "p1", choiceId: "b" })).rejects.toMatchObject({
            code: DossierReviewErrorCode.CriticDecided,
        })
    })

    it("a typed answer may only name a fact the point cites", async () => {
        const { service } = await build(pointOf())
        await expect(
            service.answer(OWNER, { workspaceId: WS, findingId: "p1", answer: { kind: "pick", factId: "someone-else", value: null } }),
        ).rejects.toMatchObject({ code: DossierReviewErrorCode.CriticAnswerInvalid })
    })
})
