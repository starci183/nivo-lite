import { REGISTRY, factOf, gapOf } from "../../../tests/fixtures/builders/setup-cards.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { EventsService } from "@modules/domain/events"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import { SetupWritesService } from "@modules/domain/module-setup-writes"
import type { CardRecord, FactCardPayload, RuleCardPayload } from "@modules/domain/module-setup-writes"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { ACCOUNTING_MODULE } from "./accounting.contracts"
import { ModulesErrorCode } from "./errors/modules.error"
import type { CardDecision } from "./module-setup.contracts"
import { ModulesService } from "./modules.service"
import { SetupCardsService } from "./setup-cards.service"
const NOW = "2026-10-13T02:00:00.000Z"
const FACT: FactCardPayload = {
    subjectType: "business",
    subjectLabel: "Shop",
    attributeLabel: "Opening hours",
    value: "7 to 21",
    scope: "public",
}
const RULE: RuleCardPayload = { action: "issue_invoice", field: "limit_vnd", mode: "auto", limitVnd: 5000000 }
const CARD_BASE: Omit<CardRecord, "kind" | "payload"> = {
    id: "card-1",
    workspaceId: "ws-1",
    setupSessionId: "s-1",
    sourceMessageId: "m-1",
    gateKey: "scope",
    targetKey: "fact:shop|opening-hours",
    status: "proposed",
    result: null,
    decidedBy: null,
    createdAt: "2026-10-13T01:00:00.000Z",
}
const factCard = (payload: Partial<FactCardPayload> = {}, status: CardRecord["status"] = "proposed"): CardRecord => ({
    ...CARD_BASE,
    status,
    kind: "fact",
    payload: { ...FACT, ...payload },
})
const ruleCard = (payload: Partial<RuleCardPayload> = {}): CardRecord => ({
    ...CARD_BASE,
    targetKey: "rule:issue_invoice",
    kind: "rule",
    payload: { ...RULE, ...payload },
})
const ruleOf = builder<AuthorityRuleRecord>({
    id: "rule-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "issue_invoice",
    mode: "ask",
    limit_vnd: 1000000,
    required_fields: ["customer"],
    note: "",
    updated_at: "2026-10-01T00:00:00.000Z",
    unit: "vnd",
    auto_max: null,
    ask_max: null,
    agents: [],
    approver_roles: ["owner", "manager"],
    approver_rooms: [],
    approver_members: [],
    approval_policy: "any",
    timeout_minutes: 30,
})
const SESSION: SetupSessionRecord = {
    id: "s-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    revision: 1,
    status: "draft",
    draft: { summary: "", facts: [] },
    gateEvidence: {},
    createdAt: NOW,
}
const installationOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "accounting",
    name: "Accounting",
    isMulti: true,
    agentId: "agent-1",
    agentName: "Accounting",
    agentHandle: "accounting",
    agentAvatarUrl: null,
    status: "setup",
    operatingMode: "assist",
    liveEnabled: false,
    activeContextVersionId: null,
    activeVersion: null,
    settings: {},
    createdAt: NOW,
})
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
    modules.catalog.mockResolvedValue({ categories: [], modules: [ACCOUNTING_MODULE] })
    modules.find.mockResolvedValue(ACCOUNTING_MODULE)
    const facts = mock<BrainFactsService>()
    facts.byKey.mockResolvedValue([])
    facts.propose.mockResolvedValue({ fact: factOf(), outcome: "applied" })
    const rules = mock<AuthorityRulesService>()
    rules.list.mockResolvedValue([])
    const actions = mock<AuthorityActionsService>({ list: jest.fn().mockResolvedValue(REGISTRY) })
    const gaps = mock<KnowledgeGapsService>()
    const events = mock<EventsService>()
    const sync = mock<AgentSyncService>()
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
            { provide: AuthorityRulesService, useValue: rules },
            { provide: AuthorityActionsService, useValue: actions },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: EventsService, useValue: events },
            { provide: AgentSyncService, useValue: sync },
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
        rules,
        gaps,
        events,
        sync,
    }
}
describe("SetupCardsService > openGapsOf", () => {
    it("answers at most five open questions of the module", async () => {
        const { service, gaps } = await build()
        gaps.list.mockResolvedValue([
            gapOf({ id: "other", module: "sales" }),
            ...Array.from({ length: 6 }, (_, n) => gapOf({ id: `gap-${n}` })),
        ])
        const open = await service.openGapsOf("ws-1", "accounting")
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
    it("keeps a fact, completes a rule from the catalogue and drops a rule that changes nothing", async () => {
        const { service, writes } = await build()
        await service.propose("ws-1", "s-1", "m-1", [
            { gateKey: "scope", kind: "fact", payload: FACT },
            {
                gateKey: "limits",
                kind: "rule",
                payload: { action: "issue_invoice", field: "limit_vnd", mode: null, limitVnd: 5000000 },
            },
            {
                gateKey: "limits",
                kind: "rule",
                payload: { action: "issue_invoice", field: "mode", mode: "auto", limitVnd: undefined },
            },
        ])
        expect(writes.propose.mock.calls).toEqual([
            [
                "ws-1",
                "s-1",
                "m-1",
                [
                    { gate_key: "scope", kind: "fact", target_key: "fact:shop|opening-hours", payload: FACT },
                    {
                        gate_key: "limits",
                        kind: "rule",
                        target_key: "rule:issue_invoice",
                        payload: { action: "issue_invoice", field: "limit_vnd", mode: "auto", limitVnd: 5000000 },
                    },
                ],
            ],
        ])
    })

    it("reads the rule in force from the stored rules first", async () => {
        const { service, writes, rules } = await build()
        rules.list.mockResolvedValue([ruleOf()])
        await service.propose("ws-1", "s-1", "m-1", [
            {
                gateKey: "limits",
                kind: "rule",
                payload: { action: "issue_invoice", field: "mode", mode: "auto", limitVnd: undefined },
            },
        ])
        expect(writes.propose.mock.calls[0]?.[3]).toEqual([
            {
                gate_key: "limits",
                kind: "rule",
                target_key: "rule:issue_invoice",
                payload: { action: "issue_invoice", field: "mode", mode: "auto", limitVnd: 1000000 },
            },
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
        writes.ofSessions.mockResolvedValue([ruleCard(), factCard(), decided])
        facts.byKey.mockResolvedValue([factOf({ value: "8 to 20", scope: "internal" })])
        await expect(service.viewsOf("ws-1", ["s-1"])).resolves.toEqual([
            { card: ruleCard(), current: { kind: "rule", mode: "auto", limitVnd: 20000000 } },
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
    it("saves a confirmed rule with the edit of the owner and records it", async () => {
        const { service, writes, rules, events } = await build()
        writes.find.mockResolvedValue(ruleCard())
        rules.save.mockResolvedValue(ruleOf({ id: "rule-9", mode: "auto", limit_vnd: 3000000 }))
        await service.decide("u1", "ws-1", "card-1", { decision: "confirm", limitVnd: 3000000 }, "en")
        expect(rules.save).toHaveBeenCalledWith("ws-1", {
            action: "issue_invoice",
            department: "accounting",
            mode: "auto",
            limit_vnd: 3000000,
            required_fields: ["customer", "amount_vnd"],
            note: null,
        })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "authority.rule_updated",
            actor: "Lan",
            summary: `accounting.issue_invoice -> auto < 3000000 (${ACCOUNTING_MODULE.name.en} setup chat)`,
        })
        expect(writes.close.mock.calls[0]?.[2]).toEqual({
            status: "applied",
            payload: { ...RULE, limitVnd: 3000000 },
            result: { outcome: "applied", ruleId: "rule-9" },
            decidedBy: "Lan",
        })
        writes.find.mockResolvedValue(ruleCard({ action: "send_email" }))
        rules.save.mockResolvedValue(ruleOf({ action: "send_email", mode: "never", limit_vnd: null }))
        await service.decide("u1", "ws-1", "card-1", { decision: "confirm", mode: "never" }, "vi")
        expect(rules.save).toHaveBeenCalledWith("ws-1", {
            action: "send_email",
            department: "accounting",
            mode: "never",
            limit_vnd: null,
            required_fields: ["contact"],
            note: null,
        })
        expect(events.record.mock.calls.at(-1)?.[0]?.summary).toBe(
            `accounting.send_email -> never (${ACCOUNTING_MODULE.name.vi} setup chat)`,
        )
    })
})

describe("SetupCardsService > decide", () => {
    it.each([
        ["unknown", "never", ModulesErrorCode.CardRuleUnknownAction],
        ["pay_vendor", "auto", ModulesErrorCode.CardRuleModeCapped],
    ] as const)("refuses the rule of %s as the Authority page would", async (action, mode, code) => {
        const { service, writes, rules } = await build()
        writes.find.mockResolvedValue(ruleCard({ action }))
        const decision = { decision: "confirm", mode } as const
        await expect(service.decide("u1", "ws-1", "card-1", decision, "en")).rejects.toMatchObject({ code })
        expect(rules.save).not.toHaveBeenCalled()
    })
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
            modules: ["accounting"],
            sourceKind: "owner",
            proposedBy: "Lan",
            evidence: [
                {
                    kind: "message",
                    ref: "m-1",
                    label: `${ACCOUNTING_MODULE.name.en} - setup chat (scope)`,
                    at: NOW,
                },
            ],
            installationId: "inst-1",
        })
        expect(sync.requestNow).toHaveBeenCalledWith({ workspaceId: "ws-1", installationId: null, force: false })
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
                label: `${ACCOUNTING_MODULE.name.en} - setup chat (scope)`,
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
