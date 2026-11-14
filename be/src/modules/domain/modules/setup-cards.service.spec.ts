import { SESSION, factOf, gapOf, installationOf, FACT, factCard } from "../../../tests/fixtures/builders/setup-cards.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { SetupWritesService } from "@modules/domain/module-setup-writes"
import { InstallationChangesService } from "./installation-changes.service"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { ModulesErrorCode } from "./errors/modules.error"
import type { CardDecision } from "./module-setup.contracts"
import { ModulesService } from "./modules.service"
import { SetupCardsService } from "./setup-cards.service"
import { catalogModuleOf } from "./modules.testing"

const SALES_MODULE = catalogModuleOf("sales")
const NOW = "2026-10-13T02:00:00.000Z"
const build = async () => {
    const writes = mock<SetupWritesService>()
    const closed = factCard({}, "applied")
    writes.close.mockResolvedValue(closed)
    const sessions = mock<SetupSessionsService>()
    sessions.find.mockResolvedValue(SESSION)
    const messages = mock<SetupMessagesService>()
    messages.find.mockResolvedValue(null)
    const installations = mock<InstallationRecordsService>()
    installations.find.mockResolvedValue(installationOf())
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "u1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const modules = mock<ModulesService>()
    modules.catalog.mockResolvedValue({ categories: [], modules: [SALES_MODULE] })
    modules.find.mockResolvedValue(SALES_MODULE)
    const facts = mock<BrainFactsService>()
    facts.byKey.mockResolvedValue([])
    facts.propose.mockResolvedValue({ fact: factOf(), outcome: "applied" })
    const gaps = mock<KnowledgeGapsService>()
    const sync = mock<InstallationChangesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SetupCardsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: SetupWritesService, useValue: writes },
            { provide: SetupSessionsService, useValue: sessions },
            { provide: SetupMessagesService, useValue: messages },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ModulesService, useValue: modules },
            { provide: BrainFactsService, useValue: facts },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: InstallationChangesService, useValue: sync },
        ],
    }).compile()
    return {
        service: moduleRef.get(SetupCardsService),
        closed,
        writes,
        sessions,
        installations,
        messages,
        facts,
        gaps,
        sync,
    }
}
describe("SetupCardsService > openGapsOf", () => {
    it("answers at most five open questions of the module", async () => {
        const { service, gaps } = await build()
        gaps.list.mockResolvedValue([
            gapOf({ id: "other", module: "chatbot" }),
            ...Array.from({ length: 6 }, (_, n) => gapOf({ id: `gap-${n}` })),
        ])
        const open = await service.openGapsOf("ws-1", "sales")
        expect(open.map((gap) => gap.id)).toEqual(["gap-0", "gap-1", "gap-2", "gap-3", "gap-4"])
        expect(open[0]).toEqual({
            id: "gap-0",
            question: "Do you take cards?",
            topic: null,
            attributeGuess: null,
            count: 3,
        })
    })
})

describe("SetupCardsService > propose", () => {
    it("stores each proposed fact as a waiting card of its target", async () => {
        const { service, writes } = await build()
        await service.propose("ws-1", "s-1", "m-1", [{ gateKey: "scope", kind: "fact", payload: FACT }])
        expect(writes.propose.mock.calls).toEqual([
            [
                "ws-1",
                "s-1",
                "m-1",
                [{ gate_key: "scope", kind: "fact", target_key: "fact:shop|opening-hours", payload: FACT }],
            ],
        ])
    })
})

describe("SetupCardsService > viewsOf", () => {
    it("answers nothing for sessions without cards", async () => {
        const { service, writes } = await build()
        writes.ofSessions.mockResolvedValue([])
        await expect(service.viewsOf("ws-1", ["s-1"])).resolves.toEqual([])
    })

    it("pairs each waiting card with the value it would replace", async () => {
        const { service, writes, facts } = await build()
        const decided = factCard({}, "applied")
        writes.ofSessions.mockResolvedValue([factCard(), decided])
        facts.byKey.mockResolvedValue([factOf({ value: "8 to 20", scope: "internal" })])
        await expect(service.viewsOf("ws-1", ["s-1"])).resolves.toEqual([
            { card: factCard(), current: { kind: "fact", value: "8 to 20", scope: "internal", modules: [] } },
            { card: decided, current: null },
        ])
        writes.ofSessions.mockResolvedValue([factCard()])
        facts.byKey.mockResolvedValue([])
        await expect(service.viewsOf("ws-1", ["s-1"])).resolves.toEqual([{ card: factCard(), current: null }])
    })
})

describe("SetupCardsService > decide", () => {
    it("refuses a card that does not exist or was decided", async () => {
        const { service, writes } = await build()
        writes.find.mockResolvedValueOnce(null).mockResolvedValueOnce(factCard({}, "applied"))
        await expect(service.decide("u1", "ws-1", "card-1", { decision: "confirm" }, "en")).rejects.toMatchObject({
            code: ModulesErrorCode.CardNotFound,
        })
        await expect(service.decide("u1", "ws-1", "card-1", { decision: "confirm" }, "en")).rejects.toMatchObject({
            code: ModulesErrorCode.CardDecided,
        })
    })

    it("refuses a card whose installation is gone", async () => {
        const { service, writes, installations, sessions } = await build()
        writes.find.mockResolvedValue(factCard())
        installations.find.mockResolvedValue(null)
        await expect(service.decide("u1", "ws-1", "card-1", { decision: "confirm" }, "en")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationNotFound,
        })
        sessions.find.mockResolvedValue(null)
        await expect(service.decide("u1", "ws-1", "card-1", { decision: "confirm" }, "en")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationNotFound,
        })
    })

    it("closes a rejected card without writing anything", async () => {
        const { service, writes, facts, closed } = await build()
        writes.find.mockResolvedValue(factCard())
        await expect(service.decide("u1", "ws-1", "card-1", { decision: "reject" }, "en")).resolves.toBe(closed)
        expect(writes.close).toHaveBeenCalledWith("ws-1", "card-1", {
            status: "rejected",
            payload: FACT,
            result: { outcome: "rejected" },
            decidedBy: "Lan",
        })
        expect(facts.propose).not.toHaveBeenCalled()
        writes.close.mockResolvedValue(null)
        await expect(service.decide("u1", "ws-1", "card-1", { decision: "reject" }, "en")).rejects.toMatchObject({
            code: ModulesErrorCode.CardDecided,
        })
    })
})

describe("SetupCardsService > decide", () => {
    it.each([undefined, null, "", "private", 0, {}, []])("keeps the fact scope for edit %p", async (scope) => {
        const { service, writes, facts, sync, installations, messages, gaps, closed } = await build()
        writes.find.mockResolvedValue(factCard({ scope: "restricted" }))
        const edit: CardDecision = { decision: "confirm", onlyThisAgent: true }
        if (scope !== undefined) Object.defineProperty(edit, "scope", { value: scope })
        await service.decide("u1", "ws-1", "card-1", edit, "en")
        expect(facts.propose).toHaveBeenCalledWith("ws-1", {
            subjectType: "business",
            subjectLabel: "Shop",
            attributeLabel: "Opening hours",
            value: "7 to 21",
            scope: "restricted",
            modules: ["sales"],
            sourceKind: "owner",
            proposedBy: "Lan",
            evidence: [
                {
                    kind: "message",
                    ref: "m-1",
                    label: `${SALES_MODULE.name.en} - setup chat (scope)`,
                    at: NOW,
                },
            ],
            installationId: "inst-1",
        })
        expect(sync.announceNow).toHaveBeenCalledWith({ workspaceId: "ws-1", installationId: null, force: false })
        expect(writes.close.mock.calls[0]?.[2]).toEqual({
            status: "applied",
            payload: { ...FACT, scope: "restricted" },
            result: { outcome: "applied", factId: "fact-1" },
            decidedBy: "Lan",
        })
        writes.find.mockResolvedValue({ ...factCard({ gapId: "g1" }), sourceMessageId: null })
        installations.find.mockResolvedValue(installationOf({ isMulti: false }))
        facts.byKey.mockResolvedValue([factOf()])
        await expect(
            service.decide(
                "u1",
                "ws-1",
                "card-1",
                {
                    decision: "confirm",
                    subjectLabel: " Cafe ",
                    attributeLabel: " Hours ",
                    scope: "internal",
                    onlyThisAgent: true,
                },
                "en",
            ),
        ).resolves.toBe(closed)
        expect(facts.propose.mock.calls[1]?.[1]).toMatchObject({
            subjectLabel: "Cafe",
            attributeLabel: "Hours",
            scope: "internal",
            installationId: null,
            modules: [],
        })
        expect(facts.propose.mock.calls[1]?.[1]?.evidence).toEqual([
            {
                kind: "message",
                ref: "setup:s-1",
                label: `${SALES_MODULE.name.en} - setup chat (scope)`,
                at: NOW,
            },
        ])
        expect(gaps.answer).toHaveBeenCalledWith("ws-1", "g1", "fact:fact-1")
        expect(messages.find).toHaveBeenCalledTimes(1)
    })
})

describe("SetupCardsService > decide", () => {
    it.each([{ value: "  " }, { subjectLabel: " " }, { attributeLabel: " " }])("empty %p", async (edit) => {
        const { service, writes } = await build()
        writes.find.mockResolvedValue(factCard())
        await expect(
            service.decide("u1", "ws-1", "card-1", { decision: "confirm", ...edit }, "en"),
        ).rejects.toMatchObject({ code: ModulesErrorCode.CardFactIncomplete })
    })

    it("asks how to resolve a different value in force, and keeps the current one on request", async () => {
        const { service, writes, facts } = await build()
        writes.find.mockResolvedValue(factCard())
        facts.byKey.mockResolvedValue([factOf({ value: "8 to 20" })])
        await expect(service.decide("u1", "ws-1", "card-1", { decision: "confirm" }, "en")).rejects.toMatchObject({
            code: ModulesErrorCode.CardNeedsResolution,
        })
        await service.decide("u1", "ws-1", "card-1", { decision: "confirm", resolution: "keep" }, "en")
        expect(writes.close.mock.calls[0]?.[2]).toEqual({
            status: "rejected",
            payload: FACT,
            result: { outcome: "kept_current", resolution: "keep" },
            decidedBy: "Lan",
        })
        expect(facts.propose).not.toHaveBeenCalled()
    })

    it("keeps both values only for a named situation", async () => {
        const { service, writes, facts, messages } = await build()
        writes.find.mockResolvedValue(factCard())
        facts.byKey.mockResolvedValue([factOf({ value: "8 to 20" })])
        await expect(
            service.decide("u1", "ws-1", "card-1", { decision: "confirm", resolution: "both" }, "en"),
        ).rejects.toMatchObject({ code: ModulesErrorCode.CardNeedsSituation })
        await service.decide(
            "u1",
            "ws-1",
            "card-1",
            { decision: "confirm", resolution: "both", situation: "Tet" },
            "en",
        )
        expect(facts.propose.mock.calls[0]?.[1]).toMatchObject({ attributeLabel: "Opening hours (Tet)" })
        messages.find.mockResolvedValue({
            id: "m-1",
            setupSessionId: "s-1",
            role: "user",
            author: "Lan",
            body: "q".repeat(305),
            createdAt: NOW,
        })
        await service.decide("u1", "ws-1", "card-1", { decision: "confirm", resolution: "replace" }, "en")
        expect(facts.propose.mock.calls[1]?.[1]?.evidence?.[0]?.quote).toBe("q".repeat(300))
        expect(writes.close.mock.calls[1]?.[2]?.result?.resolution).toBe("replace")
    })

    it("refuses a fact the Second Brain did not apply", async () => {
        const { service, writes, facts } = await build()
        writes.find.mockResolvedValue(factCard())
        facts.propose.mockResolvedValue({ fact: factOf({ status: "proposed" }), outcome: "proposed" })
        await expect(service.decide("u1", "ws-1", "card-1", { decision: "confirm" }, "en")).rejects.toMatchObject({
            code: ModulesErrorCode.CardFactNotApplied,
        })
    })
})

