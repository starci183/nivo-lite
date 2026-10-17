import type { CredentialPrincipal } from "@modules/domain/identity"
import {
    jobOf,
    termsOf,
    template,
    modelLetter,
    candidateOf,
    TOKEN,
    staleResponses,
    text,
    contextOf,
    onboarding,
    modelOutput,
    generatorValue,
    offerOf,
} from "@tests/fixtures/builders/hiring-offers.builder"
import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ApprovalGate, OfficeLog, ModuleTextGenerator } from "@modules/domain/module-ops"

import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HiringErrorCode } from "./errors/hiring.error"
import type { Delivery, OfferTerms } from "./hiring.contracts"
import type { RequestOfferParams } from "./hiring-operations.contracts"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringNotifyService } from "./hiring-notify.service"
import { HiringOffersService } from "./hiring-offers.service"
import { HiringTextService } from "./hiring-text.service"
import { ANSWER_OFFER, CANCEL_OFFER, CREATE_OFFER, LINK_OFFER, MARK_OFFER_SENT } from "./persistence/hiring.sql"
const publicNotFound = { code: HiringErrorCode.PublicNotFound }

const requestOf = builder<RequestOfferParams>({ candidateId: "candidate-1", ...termsOf() })
const deliveryOf = builder<Delivery>({ via: "email", delivered: true, note: "delivery-note" })
const createCalls = (terms: OfferTerms = termsOf(), stored = "waiting") => {
    const json = JSON.stringify({
        title: terms.title,
        pay: terms.pay,
        start_date: terms.startDate,
        probation: terms.probation,
        note: terms.note,
    })
    return [
        [CREATE_OFFER, ["ws-1", "candidate-1", "job-1", json, TOKEN, "user-1"]],
        [LINK_OFFER, ["ws-1", "offer-1", "work-1", stored]],
    ]
}
const gateValue = (draft: string, key: string, terms: OfferTerms, contact: string, title: string) => ({
    workspaceId: "ws-1",
    actor: "Manager",
    action: "send_offer",
    subjectType: "candidate",
    subjectId: "candidate-1",
    dedupeKey: "send_offer:offer-1",
    summary: text(key, { name: "Alice", title, pay: terms.pay }),
    draft,
    fields: { candidate_id: "candidate-1", offer_id: "offer-1", contact },
})
const answerCalls = (accept = true, name = "Alice", key = "hiring.event.offerAccepted") => [
    [ANSWER_OFFER, [TOKEN, accept, onboarding, name, text(key)]],
]
const requestCaseOf = builder({
    label: "clean model paragraphs",
    input: requestOf(),
    terms: termsOf(),
    ok: true,
    output: modelOutput,
    status: "waiting_decision",
    stored: "waiting",
    draft: modelLetter(),
    summaryKey: "hiring.offer.summary",
    email: "alice@example.com",
    contact: "alice@example.com",
    title: "Lead Barista",
})
const fallbackCaseOf = builder({
    ...requestCaseOf(),
    ok: false,
    output: "",
    draft: template(),
    summaryKey: "hiring.offer.summaryTemplate",
})
const boundedTerms = termsOf({
    title: "x".repeat(140),
    pay: "p".repeat(200),
    startDate: "s".repeat(60),
    probation: "b".repeat(100),
    note: "n".repeat(600),
})
const oversizedInput = requestOf({
    title: ` ${"x".repeat(141)} `,
    pay: ` ${"p".repeat(201)} `,
    startDate: ` ${"s".repeat(61)} `,
    probation: ` ${"b".repeat(101)} `,
    note: ` ${"n".repeat(601)} `,
})
const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<HiringTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    words.textOf.mockImplementation((key, params) => catalog.get(key, { ...params }, "vi"))
    words.amount.mockImplementation((amount) => `amount:${amount}`)
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Manager",
        status: "active",
    })
    const gate = mock<ApprovalGate>()
    const generator = mock<ModuleTextGenerator>()
    const office = mock<OfficeLog>()
    office.workspaceName.mockResolvedValue("Coffee Shop")
    const data = mock<HiringDataService>()
    data.hasActiveOffer.mockResolvedValue(false)
    data.job.mockResolvedValue(jobOf())
    data.newToken.mockResolvedValue(TOKEN)
    data.offer.mockResolvedValue(offerOf())
    data.offerByToken.mockResolvedValue(offerOf())
    data.heads.mockResolvedValue({ candidateName: "Alice", jobTitle: "Barista", jobLocation: "Main Street" })
    data.candidateHead.mockResolvedValue({ id: "candidate-1", name: "Alice" })
    data.jobHead.mockResolvedValue({ title: "Barista", location: "Main Street", position: "Barista" })
    const links = mock<HiringLinksService>()
    links.offer.mockImplementation((token) => `offer:${token}`)
    const notify = mock<HiringNotifyService>()
    notify.toCandidate.mockResolvedValue(deliveryOf())
    const candidates = mock<HiringCandidatesService>()
    candidates.requireOpenCandidate.mockResolvedValue(candidateOf())
    candidates.requireCandidate.mockResolvedValue(candidateOf())
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringOffersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T00:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ApprovalGate, useValue: gate },
            { provide: ModuleTextGenerator, useValue: generator },
            { provide: OfficeLog, useValue: office },
            { provide: HiringDataService, useValue: data },
            { provide: HiringTextService, useValue: words },
            { provide: HiringLinksService, useValue: links },
            { provide: HiringNotifyService, useValue: notify },
            { provide: HiringCandidatesService, useValue: candidates },
        ],
    }).compile()
    const service = moduleRef.get(HiringOffersService)
    return { service, words, members, gate, generator, office, data, links, notify, candidates }
}

describe("HiringOffersService", () => {
    it.each([
        requestCaseOf(),
        fallbackCaseOf({ label: "failed model", status: "done", stored: "sent" }),
        fallbackCaseOf({
            label: "invalid model JSON",
            ok: true,
            output: "not json",
            status: "unexpected",
            stored: "draft",
        }),
        fallbackCaseOf({
            label: "short closing",
            ok: true,
            output: JSON.stringify({ opening: "Welcome to our team.", closing: "short" }),
        }),
        fallbackCaseOf({
            label: "unfair opening",
            ok: true,
            output: JSON.stringify({
                opening: "Please hire nu for this role.",
                closing: "We look forward to meeting you.",
            }),
        }),
        fallbackCaseOf({
            label: "job title and phone fallback",
            input: requestOf({ title: "  " }),
            terms: termsOf({ title: "" }),
            draft: template(termsOf({ title: "Barista" })),
            email: "",
            contact: "0901234567",
            title: "Barista",
        }),
        requestCaseOf({
            label: "trimmed and bounded terms",
            input: oversizedInput,
            terms: boundedTerms,
            draft: modelLetter(boundedTerms),
            title: boundedTerms.title,
        }),
    ])(
        "request preserves exact terms and side effects for $label",
        async ({ input, terms, ok, output, status, stored, draft, summaryKey, email, contact, title }) => {
            const em = mockEntityManager({
                query: [
                    [CREATE_OFFER, [{ id: "offer-1" }]],
                    [LINK_OFFER, []],
                ],
            })
            const { service, words, members, gate, generator, data, candidates } = await build(em)
            candidates.requireOpenCandidate.mockResolvedValue(candidateOf({ email }))
            generator.generate.mockResolvedValue({ ok, output })
            gate.request.mockResolvedValue({ status, workItemId: "work-1" })
            await expect(service.request("user-1", "ws-1", input)).resolves.toEqual({
                status,
                summary: text("hiring.offer.asked", { name: "Alice" }),
                error: null,
            })
            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(candidates.requireOpenCandidate.mock.calls).toEqual([["ws-1", "candidate-1"]])
            expect(data.hasActiveOffer.mock.calls).toEqual([["candidate-1"]])
            expect(data.job.mock.calls).toEqual([["ws-1", "job-1"]])
            expect(words.amount.mock.calls).toEqual([[100]])
            expect(generator.generate.mock.calls).toEqual([[generatorValue(title)]])
            expect(gate.request.mock.calls).toEqual([[gateValue(draft, summaryKey, terms, contact, title)]])
            expect(em.query.mock.calls).toEqual(createCalls(terms, stored))
        },
    )
})

describe("HiringOffersService", () => {
    it("request refuses active offers, missing pay, protected traits and missing jobs", async () => {
        const em = mockEntityManager()
        const { service, data, gate } = await build(em)
        const request = (params: RequestOfferParams) => service.request("user-1", "ws-1", params)
        data.hasActiveOffer.mockResolvedValueOnce(true)
        await expect(request(requestOf())).rejects.toMatchObject({ code: HiringErrorCode.OfferOpen })
        await expect(request(requestOf({ pay: "  " }))).rejects.toMatchObject({
            code: HiringErrorCode.OfferPayRequired,
        })
        await expect(request(requestOf({ note: "nu" }))).rejects.toMatchObject({
            code: HiringErrorCode.Unfair,
            params: { detail: text("hiring.fairness.offer", { trait: text("hiring.fairness.gender") }) },
        })
        data.job.mockResolvedValue(undefined)
        await expect(request(requestOf())).rejects.toMatchObject({ code: HiringErrorCode.JobNotFound })
        expect(em.query).not.toHaveBeenCalled()
        expect(gate.request).not.toHaveBeenCalled()
    })

    it.each([{ rows: [] }, { rows: [{ id: null }] }])("refuses created rows $rows", async ({ rows }) => {
        const em = mockEntityManager({ query: [CREATE_OFFER, rows] })
        const { service, generator, gate } = await build(em)
        await expect(service.request("user-1", "ws-1", requestOf())).rejects.toMatchObject({
            code: HiringErrorCode.OfferNotFound,
        })
        expect(generator.generate).not.toHaveBeenCalled()
        expect(gate.request).not.toHaveBeenCalled()
    })
})

describe("HiringOffersService", () => {
    it.each([
        {
            draft: " Approved letter ",
            title: "Lead Barista",
            body: "Approved letter",
            delivery: deliveryOf(),
            detail: {},
        },
        ...[null, "", "  "].map((draft) => ({
            draft,
            title: "Lead Barista",
            body: template(),
            delivery: deliveryOf({ via: "manual", delivered: false, note: "manual-note" }),
            detail: { detail: `offer:${TOKEN}` },
        })),
        { draft: null, title: "", body: template(termsOf({ title: "Barista" })), delivery: deliveryOf(), detail: {} },
    ])("perform sends '$draft'", async ({ draft, title, body, delivery, detail }) => {
        const em = mockEntityManager({ query: [MARK_OFFER_SENT, [{ value: true }]] })
        const { service, data, candidates, notify, links } = await build(em)
        data.offer.mockResolvedValue(offerOf({ terms: termsOf({ title }) }))
        notify.toCandidate.mockResolvedValue(delivery)
        await expect(service.perform(contextOf({ draft }))).resolves.toEqual({
            summary: text("hiring.offer.sent", { name: "Alice", note: delivery.note }),
            evidence: "captured",
            ...detail,
        })
        expect(data.offer.mock.calls).toEqual([["ws-1", "offer-1"]])
        expect(candidates.requireCandidate.mock.calls).toEqual([["ws-1", "candidate-1"]])
        expect(data.job.mock.calls).toEqual([["ws-1", "job-1"]])
        expect(links.offer.mock.calls).toEqual([[TOKEN]])
        const message = {
            subject: text("hiring.offer.subject", { title: title || "Barista" }),
            text: `${body}\n\n${text("hiring.offer.replyAt", { link: `offer:${TOKEN}` })}`,
            workItemId: "work-1",
        }
        expect(notify.toCandidate.mock.calls).toEqual([[candidateOf(), message]])
        const event = text("hiring.event.offerSent", { actor: "Manager", note: delivery.note })
        const args = ["ws-1", "offer-1", body, delivery.via, "2026-10-19T00:00:00.000Z", "Manager", event]
        expect(em.query.mock.calls).toEqual([[MARK_OFFER_SENT, args]])
    })

    it("perform refuses missing offers and jobs before delivering", async () => {
        const { service, data, notify } = await build()
        data.offer.mockResolvedValueOnce(undefined)
        await expect(service.perform(contextOf())).rejects.toMatchObject({ code: HiringErrorCode.OfferNotFound })
        data.job.mockResolvedValue(undefined)
        await expect(service.perform(contextOf())).rejects.toMatchObject({ code: HiringErrorCode.JobNotFound })
        expect(notify.toCandidate).not.toHaveBeenCalled()
    })

    it("reject cancels only draft and waiting offers", async () => {
        const em = mockEntityManager({ query: [CANCEL_OFFER, []] })
        const { service } = await build(em)
        await service.reject(contextOf())
        expect(em.query.mock.calls).toEqual([
            [CANCEL_OFFER, ["ws-1", "offer-1", ["draft", "waiting"], "Manager", text("hiring.event.offerNotApproved")]],
        ])
    })
})

describe("HiringOffersService", () => {
    it.each([
        {
            workItemId: "work-1",
            decisions: [[{ workspaceId: "ws-1", workItemId: "work-1", decision: "rejected", decidedBy: "user-1" }]],
        },
        { workItemId: null, decisions: [] },
    ])("cancel removes the offer and waiting decision $workItemId", async ({ workItemId, decisions }) => {
        const em = mockEntityManager({ query: [CANCEL_OFFER, [{ work_item_id: workItemId }]] })
        const { service, members, gate } = await build(em)
        await service.cancel("user-1", "ws-1", { id: "offer-1" })
        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
        const event = text("hiring.event.offerCancelled")
        expect(em.query.mock.calls).toEqual([
            [CANCEL_OFFER, ["ws-1", "offer-1", ["draft", "waiting", "sent"], "Manager", event]],
        ])
        expect(gate.decide.mock.calls).toEqual(decisions)
    })

    it("cancel refuses an offer that cannot be cancelled", async () => {
        const em = mockEntityManager({ query: [CANCEL_OFFER, []] })
        const { service, gate } = await build(em)
        await expect(service.cancel("user-1", "ws-1", { id: "offer-1" })).rejects.toMatchObject({
            code: HiringErrorCode.OfferNotCancellable,
        })
        expect(gate.decide).not.toHaveBeenCalled()
    })

    it("publicView returns exact public terms and refuses missing heads", async () => {
        const { service, data, office } = await build()
        await expect(service.publicView({ token: TOKEN })).resolves.toEqual({
            status: "sent",
            candidateName: "Alice",
            jobTitle: "Barista",
            location: "Main Street",
            shop: "Coffee Shop",
            letter: "Stored letter",
            expiresAt: "2026-10-19T00:00:00.000Z",
            terms: termsOf(),
        })
        expect(data.offerByToken.mock.calls).toEqual([[TOKEN]])
        expect(data.heads.mock.calls).toEqual([["candidate-1", "job-1"]])
        expect(office.workspaceName.mock.calls).toEqual([["ws-1"]])
        data.heads.mockResolvedValue(undefined)
        await expect(service.publicView({ token: TOKEN })).rejects.toMatchObject(publicNotFound)
    })

    it("publicView and respond refuse malformed and missing tokens", async () => {
        const { service, data } = await build()
        await expect(service.publicView({ token: "bad" })).rejects.toMatchObject(publicNotFound)
        await expect(service.respond({ token: "bad", accept: true })).resolves.toEqual({ outcome: "invalid" })
        expect(data.offerByToken).not.toHaveBeenCalled()
        data.offerByToken.mockResolvedValue(undefined)
        await expect(service.publicView({ token: TOKEN })).rejects.toMatchObject(publicNotFound)
        await expect(service.respond({ token: TOKEN, accept: true })).resolves.toEqual({ outcome: "invalid" })
    })
})

describe("HiringOffersService", () => {
    it.each([
        { offer: offerOf({ status: "draft" }), outcome: "invalid" },
        { offer: offerOf({ status: "waiting" }), outcome: "invalid" },
        { offer: offerOf({ status: "cancelled" }), outcome: "invalid" },
        { offer: offerOf({ status: "accepted" }), outcome: "already_accepted" },
        { offer: offerOf({ status: "declined" }), outcome: "already_declined" },
        { offer: offerOf({ status: "expired" }), outcome: "expired" },
        { offer: offerOf({ expiresAt: "2026-10-11T23:59:59.999Z" }), outcome: "expired" },
        { offer: Object.defineProperty(offerOf(), "status", { value: "unexpected" }), outcome: "closed" },
    ])("respond leaves settled and hidden offers unchanged with $outcome", async ({ offer, outcome }) => {
        const em = mockEntityManager()
        const { service, data } = await build(em)
        data.offerByToken.mockResolvedValue(offer)
        const principal = await service.authenticateLink(TOKEN)
        await expect(service.respond({ token: TOKEN, accept: true }, principal)).resolves.toEqual({ outcome })
        expect(data.candidateHead).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
        if (outcome === "invalid") {
            await expect(service.publicView({ token: TOKEN })).rejects.toMatchObject(publicNotFound)
            expect(data.heads).not.toHaveBeenCalled()
        }
    })

    it.each(staleResponses)("respond returns stale for unclaimed rows $rows", async ({ rows }) => {
        const em = mockEntityManager({ query: [ANSWER_OFFER, rows] })
        const { service, office, candidates } = await build(em)
        await expect(service.respond({ token: TOKEN, accept: true })).resolves.toEqual({ outcome: "stale" })
        expect(em.query.mock.calls).toEqual(answerCalls())
        expect(office.postOffice).not.toHaveBeenCalled()
        expect(candidates.closeJobIfFilled).not.toHaveBeenCalled()
    })

    it.each([true, false])("respond records accept=%s with exact onboarding and side effects", async (accept) => {
        const value = accept ? "accepted" : "declined"
        const suffix = accept ? "Accepted" : "Declined"
        const name = accept ? "Alice" : ""
        const title = accept ? "Barista" : ""
        const em = mockEntityManager({ query: [ANSWER_OFFER, [{ value }]] })
        const { service, data, office, candidates } = await build(em)
        data.offerByToken.mockResolvedValue(offerOf({ expiresAt: accept ? "2026-10-12T00:00:00.000Z" : null }))
        data.candidateHead.mockResolvedValue(accept ? { id: "candidate-1", name: "Alice" } : undefined)
        data.jobHead.mockResolvedValue(
            accept ? { title: "Barista", location: "Main Street", position: "Barista" } : undefined,
        )
        await expect(service.respond({ token: TOKEN, accept })).resolves.toEqual({ outcome: value })
        expect(em.query.mock.calls).toEqual(answerCalls(accept, name, `hiring.event.offer${suffix}`))
        expect(office.postOffice.mock.calls).toEqual([["ws-1", text(`hiring.office.offer${suffix}`, { name, title })]])
        expect(candidates.closeJobIfFilled.mock.calls).toEqual(accept ? [["ws-1", "job-1"]] : [])
    })
})

describe("stored link credentials", () => {
    it("resolves the stored record and workspace", async () => {
        const { service } = await build()
        await expect(service.authenticateLink(TOKEN)).resolves.toEqual({
            kind: "link-token",
            subject: "offer-1",
            workspaceId: "ws-1",
        })
    })

    it.each(["", "malformed"])("refuses malformed tokens %s before lookup", async (token) => {
        const { service, data } = await build()
        await expect(service.authenticateLink(token)).rejects.toMatchObject({ code: HiringErrorCode.PublicNotFound })
        expect(data.offerByToken).not.toHaveBeenCalled()
    })

    it("refuses an unknown stored token", async () => {
        const { service, data } = await build()
        data.offerByToken.mockResolvedValue(undefined)
        await expect(service.authenticateLink(TOKEN)).rejects.toMatchObject({ code: HiringErrorCode.PublicNotFound })
    })

    it.each<CredentialPrincipal>([
        { kind: "api-key", subject: "offer-1", workspaceId: "ws-1" },
        { kind: "link-token", subject: "foreign-record", workspaceId: "ws-1" },
        { kind: "link-token", subject: "offer-1", workspaceId: "foreign-workspace" },
    ])("refuses a mismatched principal before responding (%p)", async (principal) => {
        const { service, office } = await build()
        await expect(service.respond({ token: TOKEN, accept: true }, principal)).rejects.toMatchObject({
            code: HiringErrorCode.PublicNotFound,
        })
        expect(office.postOffice).not.toHaveBeenCalled()
    })

    it("preserves response data outcomes after link admission", async () => {
        const { service, data, office } = await build()
        data.offerByToken.mockResolvedValue(offerOf({ status: "accepted" }))
        const historical = await service.authenticateLink(TOKEN)
        await expect(service.respond({ token: TOKEN, accept: true }, historical)).resolves.toMatchObject({
            outcome: "already_accepted",
        })
        data.offerByToken.mockResolvedValue(offerOf({ status: "draft" }))
        const principal = await service.authenticateLink(TOKEN)
        await expect(service.respond({ token: TOKEN, accept: true }, principal)).resolves.toEqual({
            outcome: "invalid",
        })
        data.offerByToken.mockResolvedValue(undefined)
        await expect(service.respond({ token: TOKEN, accept: true }, principal)).resolves.toEqual({
            outcome: "invalid",
        })
        expect(office.postOffice).not.toHaveBeenCalled()
    })

    it("allows the bound public view", async () => {
        const { service } = await build()
        await expect(
            service.publicView({ token: TOKEN }, { kind: "link-token", subject: "offer-1", workspaceId: "ws-1" }),
        ).resolves.toHaveProperty("status")
    })
})
