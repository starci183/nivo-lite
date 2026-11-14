import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspaceMembersError, WorkspaceMembersErrorCode } from "@modules/domain/workspace-members/errors/workspace-members.error"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { CritiqueDecisionsService } from "./critique-decisions.service"
import { DocumentCritiqueAnswersService } from "./document-critique-answers.service"
import { DocumentCritiqueReadService } from "./document-critique-read.service"
import type { CritiquePointView } from "./document-critique-read.service"
import { DossierReviewRunsService } from "./dossier-review-runs.service"
import { DossierReviewErrorCode } from "./errors/dossier-review.error"
import { DossierFindingEntity } from "./persistence/entities"

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
        {
            id: "a",
            label: "30.000 d",
            needsInput: false,
            inputHint: null,
            answer: { kind: "pick", factId: "f30", value: "30.000 d" },
        },
        {
            id: "b",
            label: "25.000 d",
            needsInput: false,
            inputHint: null,
            answer: { kind: "pick", factId: "f25", value: "25.000 d" },
        },
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

const baseFact = builder<FactRecord>({
    id: "f-0",
    subjectType: "policy",
    subjectKey: "giao-hang-noi-thanh",
    subjectLabel: "Giao hang noi thanh",
    attribute: "phi-giao-hang",
    attributeLabel: "Phi giao hang",
    value: "30.000 d",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "proposed",
    sourceKind: "owner",
    trust: 75,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Founder",
    proposedAt: "2026-11-11T10:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const factOf = (id: string, value: string, status: FactRecord["status"] = "proposed"): FactRecord => baseFact({ id, value, status })

const memberOf = builder<WorkspaceMember>({
    userId: "u1",
    workspaceId: WS,
    role: "owner",
    staffId: null,
    displayName: "Founder",
    status: "active",
})

const build = async (point: CritiquePointView, role: Extract<WorkspaceRole, "owner" | "manager"> = "owner") => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockImplementation((_user, _ws, roles) =>
        roles !== undefined && !roles.includes(role)
            ? Promise.reject(new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.RoleForbidden }))
            : Promise.resolve(memberOf({ role })),
    )
    const critique = mock<DocumentCritiqueReadService>()
    critique.point.mockResolvedValue({ row: new DossierFindingEntity(), view: point })
    const facts = mock<BrainFactsService>()
    facts.reject.mockResolvedValue(factOf("f-rejected", "0"))
    facts.propose.mockResolvedValue({ fact: factOf("f-new", "20.000 d"), outcome: "proposed" })
    const reads = mock<BrainFactsReadService>()
    reads.byIds.mockResolvedValue([factOf("f30", "30.000 d"), factOf("f25", "25.000 d")])
    reads.byKey.mockResolvedValue([])
    const decisions = mock<CritiqueDecisionsService>()
    const runs = mock<DossierReviewRunsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentCritiqueAnswersService,
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => key) }) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: DocumentCritiqueReadService, useValue: critique },
            { provide: DossierReviewRunsService, useValue: runs },
            { provide: CritiqueDecisionsService, useValue: decisions },
            { provide: BrainFactsService, useValue: facts },
            { provide: BrainFactsReadService, useValue: reads },
        ],
    }).compile()
    return { service: moduleRef.get(DocumentCritiqueAnswersService), critique, facts, reads, decisions, runs }
}

describe("DocumentCritiqueAnswersService: choosing and typing a value", () => {
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
            // The founder's name is kept with the answer: the truth his answer settles is decided by him.
            byName: "Founder",
            note: null,
        })
    })

    it("value: the founder types the value that holds instead of either: it is filed as a new proposal (owner source, never auto-applied) on the truth's own key, and the document's competing proposal is turned down", async () => {
        const { service, facts } = await build(pointOf())
        await service.answer(OWNER, { workspaceId: WS, findingId: "p1", answer: { kind: "value", factId: "f30", value: "28.000 d" } })
        expect(facts.propose).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({
                subjectLabel: "Giao hang noi thanh",
                attributeLabel: "Phi giao hang",
                value: "28.000 d",
                sourceKind: "owner",
                autoApply: false,
            }),
        )
        expect(facts.reject.mock.calls.map((call) => call[1])).toEqual(["f30"])
    })

    it("pick on a CROSS-KEY contradiction (the same-fact judge's link): the other truth the point names is turned down too, though it sits on another key", async () => {
        const linked = pointOf({
            group: "other_document",
            kind: "other_document",
            severity: "medium",
            factIds: ["f-doc", "w-other"],
            against: { kind: "proposal", value: "28.000 d", sourceTitle: "Branch list", factId: "w-other" },
            choices: [
                { id: "a", label: "30.000 d", needsInput: false, inputHint: null, answer: { kind: "pick", factId: "f-doc", value: "30.000 d" } },
                { id: "b", label: "28.000 d", needsInput: false, inputHint: null, answer: { kind: "pick", factId: "w-other", value: "28.000 d" } },
            ],
        })
        const { service, facts, reads } = await build(linked)
        reads.byIds.mockResolvedValue([factOf("f-doc", "30.000 d"), baseFact({ id: "w-other", subjectKey: "phi-ship-noi-do", attribute: "muc-phi", value: "28.000 d" })])

        await service.answer(OWNER, { workspaceId: WS, findingId: "p1", choiceId: "a" })

        expect(facts.reject.mock.calls.map((call) => call[1])).toEqual(["w-other"])
    })
})

describe("DocumentCritiqueAnswersService: who may answer", () => {
    it("only the founder answers; a manager may skip; a decided point refuses a second answer", async () => {
        const manager = await build(pointOf(), "manager")
        await expect(manager.service.answer("m1", { workspaceId: WS, findingId: "p1", choiceId: "a" })).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.RoleForbidden,
        })
        await manager.service.skip("m1", WS, "p1", undefined)
        expect(manager.critique.skip).toHaveBeenCalledWith(WS, "p1", "m1", "critic.answer.skip")
        const decided = await build(pointOf({ state: "answered" }))
        await expect(
            decided.service.answer(OWNER, { workspaceId: WS, findingId: "p1", choiceId: "b" }),
        ).rejects.toMatchObject({
            code: DossierReviewErrorCode.CriticDecided,
        })
    })

    it("a line that speaks to the AI is the owner's alone: a manager cannot skip it (role refusal), the owner can", async () => {
        const injection = pointOf({ kind: "addressed_to_ai", severity: "high", group: "not_shop_word", choices: [] })
        const manager = await build(injection, "manager")
        await expect(manager.service.skip("m1", WS, "p1", "ok")).rejects.toMatchObject({ code: WorkspaceMembersErrorCode.RoleForbidden })
        expect(manager.critique.skip).not.toHaveBeenCalled()

        const owner = await build(injection)
        await owner.service.skip(OWNER, WS, "p1", "ok")
        expect(owner.critique.skip).toHaveBeenCalledWith(WS, "p1", OWNER, "ok")
    })

})

describe("DocumentCritiqueAnswersService: a typed keep or remove", () => {
    it("a typed keep or remove that names no truth, on a point about exactly ONE waiting truth, is about that truth; a point about several, and a choice, stay as given", async () => {
        const typed = (kind: "keep_document" | "remove") => ({ workspaceId: WS, findingId: "p1", answer: { kind, factId: null, value: null } })
        // One waiting truth beside the truth in force it is held against: the answer names the waiting one.
        const single = pointOf({ factIds: ["f-shop", "f-doc"], choices: [], against: { kind: "truth", value: "30.000 d", sourceTitle: "A", factId: "f-shop" } })
        const one = await build(single)
        one.reads.byIds.mockResolvedValue([factOf("f-shop", "30.000 d", "active"), factOf("f-doc", "300.000 d")])
        await one.service.answer(OWNER, typed("remove"))
        expect(one.facts.reject.mock.calls.map((call) => call[1])).toEqual(["f-doc"])
        expect(one.critique.recordAnswer.mock.calls[0]?.[2]).toMatchObject({ answer: { kind: "remove", factId: "f-doc" } })

        const keep = await build(single)
        keep.reads.byIds.mockResolvedValue([factOf("f-shop", "30.000 d", "active"), factOf("f-doc", "300.000 d")])
        await keep.service.answer(OWNER, typed("keep_document"))
        expect(keep.facts.reject).not.toHaveBeenCalled()
        expect(keep.critique.recordAnswer.mock.calls[0]?.[2]).toMatchObject({ answer: { kind: "keep_document", factId: "f-doc" } })

        // Two waiting truths: code does not choose between them.
        const several = await build(pointOf({ choices: [] }))
        await several.service.answer(OWNER, typed("remove"))
        expect(several.facts.reject).not.toHaveBeenCalled()
        expect(several.critique.recordAnswer.mock.calls[0]?.[2]).toMatchObject({ answer: { kind: "remove", factId: null } })
    })

    it("an answer ends somewhere: the truths it turned down close the other points about them; nothing asks for the critique again (no truth waits for a verdict)", async () => {
        const single = pointOf({ factIds: ["f-shop", "f-doc"], choices: [], against: { kind: "truth", value: "30.000 d", sourceTitle: "A", factId: "f-shop" } })
        const one = await build(single)
        one.reads.byIds
            .mockResolvedValueOnce([factOf("f-shop", "30.000 d", "active"), factOf("f-doc", "300.000 d")])
            .mockResolvedValueOnce([factOf("f-shop", "30.000 d", "active"), factOf("f-doc", "300.000 d")])
            .mockResolvedValueOnce([factOf("f-doc", "300.000 d", "rejected")])

        await one.service.answer(OWNER, { workspaceId: WS, findingId: "p1", answer: { kind: "remove", factId: null, value: null } })

        expect(one.decisions.turnedDown).toHaveBeenCalledWith(WS, ["f-doc"])
        expect(one.runs.requestForSource).not.toHaveBeenCalled()
    })

    it("text addressed to an AI has no buttons: a typed keep (the business's own text) records the answer and turns nothing down; a typed remove turns down the one truth read from its passage", async () => {
        const flag = pointOf({ group: "not_shop_word", kind: "addressed_to_ai", origin: "ai", choices: [], factIds: ["f-line"], against: null })
        const keep = await build(flag)
        keep.reads.byIds.mockResolvedValue([factOf("f-line", "0 d")])
        await keep.service.answer(OWNER, { workspaceId: WS, findingId: "p1", answer: { kind: "keep_document", factId: null, value: null } })
        expect(keep.facts.reject).not.toHaveBeenCalled()
        expect(keep.critique.recordAnswer.mock.calls[0]?.[2]).toMatchObject({ answer: { kind: "keep_document", factId: "f-line" }, byName: "Founder" })

        const remove = await build(flag)
        remove.reads.byIds.mockResolvedValue([factOf("f-line", "0 d")])
        await remove.service.answer(OWNER, { workspaceId: WS, findingId: "p1", answer: { kind: "remove", factId: null, value: null } })
        expect(remove.facts.reject.mock.calls.map((call) => call[1])).toEqual(["f-line"])
    })

})

describe("DocumentCritiqueAnswersService: what an answer may carry", () => {
    it("a typed value that is not of the type of the value in force is refused at the door: nothing is filed, the point stays open", async () => {
        const { service, facts, critique, reads } = await build(pointOf({ factIds: ["f25"], choices: [] }))
        reads.byIds.mockResolvedValue([factOf("f25", "25.000 d")])
        reads.byKey.mockResolvedValue([factOf("f-in-force", "30.000 d", "active")])

        await expect(
            service.answer(OWNER, { workspaceId: WS, findingId: "p1", answer: { kind: "value", factId: "f25", value: "later" } }),
        ).rejects.toMatchObject({ code: DossierReviewErrorCode.CriticAnswerInvalid })

        expect(facts.propose).not.toHaveBeenCalled()
        expect(critique.recordAnswer).not.toHaveBeenCalled()
    })

    it("a typed answer may only name a fact the point cites", async () => {
        const { service } = await build(pointOf())
        await expect(
            service.answer(OWNER, {
                workspaceId: WS,
                findingId: "p1",
                answer: { kind: "pick", factId: "someone-else", value: null },
            }),
        ).rejects.toMatchObject({ code: DossierReviewErrorCode.CriticAnswerInvalid })
    })
})
