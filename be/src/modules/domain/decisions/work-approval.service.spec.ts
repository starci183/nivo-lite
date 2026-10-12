import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ExecutionsService } from "@modules/domain/executions"
import { AGENT_DIRECTORY, OfficeLinesService } from "@modules/domain/messages"
import type { AgentDirectory, OptionalAgentIdentity } from "@modules/domain/messages"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { AuthorityRule, Proposal, WorkContext, WorkItem } from "./decisions.contracts"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkApprovalService } from "./work-approval.service"
import type { Judgement } from "./work-engine.contracts"
import { INBOUND_EVENT_STATUS } from "./work-engine.decorators"
import type { InboundEventStatus } from "./work-engine.port"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: "in-1",
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "S", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: "inst-1",
})

const waitingOf = (overrides: Partial<WorkItem> = {}): WorkItem =>
    itemOf({ status: "waiting_decision", reason: "over_authority", ...overrides })

const ruleOf = builder<AuthorityRule>({
    id: "rule-1",
    department: "sales",
    action: "send_quote",
    mode: "auto",
    limit_vnd: 1000,
    required_fields: [],
})

const askOf = (overrides: Partial<Judgement["verdict"]> = {}, rule: Judgement["rule"] = ruleOf()): Judgement => ({
    verdict: { verdict: "ask", reason: "over_authority", reasons: ["over_authority"], missing: [], ...overrides },
    rule,
})

const proposalOf = builder<Proposal>({ summary: "Quote", fields: {}, amount_vnd: 5000 })

const catalogDouble = mock<MessageCatalog>({
    get: jest.fn((key: string, params: Readonly<Record<string, string | number>>) => {
        if (key === "engine.field.need") return "Need"
        if (key.startsWith("engine.field.")) return key
        return `${key}(${Object.entries(params)
            .map(([name, value]) => `${name}=${value}`)
            .join(",")})`
    }),
})

const build = async (waiting: WorkItem = waitingOf(), agent: OptionalAgentIdentity = null) => {
    const evidence = jest.fn().mockResolvedValue(undefined)
    const office = jest.fn().mockResolvedValue(undefined)
    const inbound = jest.fn().mockResolvedValue(undefined)
    const agents = jest.fn().mockResolvedValue(agent)
    const markWaiting = jest.fn().mockResolvedValue(waiting)
    const open = jest.fn().mockResolvedValue("exec-1")
    const ensureFor = jest.fn().mockResolvedValue({ id: "resp-ensured" } satisfies Partial<ResponsibilityRecord>)
    const markWaitingApproval = jest.fn().mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkApprovalService,
            { provide: MESSAGE_CATALOG, useValue: catalogDouble },
            { provide: AGENT_DIRECTORY, useValue: mock<AgentDirectory>({ agentOfDepartment: agents }) },
            { provide: INBOUND_EVENT_STATUS, useValue: mock<InboundEventStatus>({ mark: inbound }) },
            { provide: WorkItemsService, useValue: mock<WorkItemsService>({ markWaiting }) },
            { provide: ExecutionsService, useValue: mock<ExecutionsService>({ open }) },
            {
                provide: ModuleCatalogService,
                useValue: mock<ModuleCatalogService>({ nameOf: jest.fn().mockResolvedValue("Sales AI") }),
            },
            { provide: EvidenceService, useValue: mock<EvidenceService>({ log: evidence }) },
            { provide: OfficeLinesService, useValue: mock<OfficeLinesService>({ post: office }) },
            {
                provide: ResponsibilityJournalService,
                useValue: mock<ResponsibilityJournalService>({ ensureFor, markWaitingApproval }),
            },
        ],
    }).compile()
    return {
        service: moduleRef.get(WorkApprovalService),
        evidence,
        office,
        inbound,
        agents,
        markWaiting,
        open,
        ensureFor,
        markWaitingApproval,
    }
}

describe("WorkApprovalService", () => {
    describe("fieldLabels", () => {
        it("names the fields and shows an unknown one as it is", async () => {
            const { service } = await build()

            expect(service.fieldLabels(ctx, ["need", "nickname"])).toBe("Need, nickname")
        })
    })

    describe("ask", () => {
        it("puts the item in front of a person and tells the log, the Office and the inbound event", async () => {
            const { service, evidence, office, inbound, markWaiting } = await build()

            const waiting = await service.ask(ctx, itemOf(), proposalOf(), askOf())

            expect(waiting.status).toBe("waiting_decision")
            expect(markWaiting).toHaveBeenCalledWith("item-1", {
                reason: "over_authority",
                reasons: ["over_authority"],
                missing: [],
                proposal: proposalOf(),
                executionId: null,
            })
            expect(evidence).toHaveBeenCalledWith(ctx, {
                lead_id: "lead-1",
                work_item_id: "item-1",
                kind: "work.asked",
                actor: "Sales AI",
                summary: "engine.reason.over_authority(): Quote",
                evidence: "engine.limitReached(limit=₫1,000,amount=₫5,000)",
            })
            expect(office).toHaveBeenCalledWith(ctx, {
                dept: "sales",
                body: "engine.ask(dept=Sales AI,reason=engine.reason.over_authority(),summary=Quote)",
                lead_id: "lead-1",
                work_item_id: "item-1",
                installation_id: "inst-1",
            })
            expect(inbound).toHaveBeenCalledWith(ctx, "in-1", "needs_decision", "lead-1")
        })

        it("names the missing fields in the evidence, before the limit, and skips an item without an inbound event", async () => {
            const { service, evidence, inbound } = await build(waitingOf({ inbound_event_id: null }))

            await service.ask(
                ctx,
                itemOf(),
                proposalOf(),
                askOf({ reason: "missing_data", reasons: ["missing_data", "over_authority"], missing: ["need"] }),
            )

            expect(evidence).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    evidence: "Need · engine.limitReached(limit=₫1,000,amount=₫5,000)",
                }),
            )
            expect(inbound).not.toHaveBeenCalled()
        })

        it("writes no evidence text when there is nothing to add", async () => {
            const { service, evidence } = await build()

            await service.ask(ctx, itemOf(), proposalOf(), askOf({ reasons: ["unclear_outcome"] }))

            expect(evidence).toHaveBeenCalledWith(ctx, expect.objectContaining({ evidence: null }))
        })

        it.each([
            ["there is no rule", null, proposalOf()],
            ["the rule has no limit", ruleOf({ limit_vnd: null }), proposalOf()],
            ["the proposal has no amount", ruleOf(), proposalOf({ amount_vnd: null })],
            ["the amount is under the limit", ruleOf(), proposalOf({ amount_vnd: 10 })],
        ])("writes no limit note when %s", async (_name, rule, proposal) => {
            const { service, evidence } = await build()

            await service.ask(ctx, itemOf(), proposal, askOf({}, rule))

            expect(evidence).toHaveBeenCalledWith(ctx, expect.objectContaining({ evidence: null }))
        })

        describe("the approval card of a follow-up", () => {
            const followUp = (overrides: Partial<WorkItem> = {}): WorkItem =>
                itemOf({ action: "send_follow_up", ...overrides })

            it("creates the card for the responsibility of the customer, with the sales agent", async () => {
                const built = await build(waitingOf(), { id: "agent-1", name: "Sales" })

                await built.service.ask(ctx, followUp(), proposalOf({ draft: "Hi there" }), askOf())

                expect(built.ensureFor).toHaveBeenCalledWith(ctx, "lead-1")
                expect(built.agents).toHaveBeenCalledWith("ws-1", "sales", null)
                expect(built.open).toHaveBeenCalledWith({
                    workspaceId: "ws-1",
                    responsibilityId: "resp-ensured",
                    agentId: "agent-1",
                    draft: "Hi there",
                    workItemId: "item-1",
                })
                expect(built.markWaitingApproval).toHaveBeenCalledWith(ctx, "resp-ensured")
                expect(built.markWaiting).toHaveBeenCalledWith(
                    "item-1",
                    expect.objectContaining({ executionId: "exec-1" }),
                )
            })

            it("uses the responsibility the proposal names and an empty draft", async () => {
                const built = await build()

                await built.service.ask(
                    ctx,
                    followUp(),
                    proposalOf({ fields: { responsibility_id: "resp-9" } }),
                    askOf(),
                )

                expect(built.ensureFor).not.toHaveBeenCalled()
                expect(built.open).toHaveBeenCalledWith({
                    workspaceId: "ws-1",
                    responsibilityId: "resp-9",
                    agentId: null,
                    draft: "",
                    workItemId: "item-1",
                })
            })

            it("asks for the customer's responsibility when the named one is blank", async () => {
                const built = await build()

                await built.service.ask(ctx, followUp(), proposalOf({ fields: { responsibility_id: "" } }), askOf())

                expect(built.ensureFor).toHaveBeenCalledTimes(1)
            })

            it.each([
                ["data is missing", followUp(), askOf({ missing: ["need"] }), null],
                ["it already has a card", followUp({ execution_id: "exec-0" }), askOf(), "exec-0"],
                ["the customer is unknown", followUp({ lead_id: null }), askOf(), null],
            ])("creates no card when %s", async (_name, item, judgement, kept) => {
                const built = await build()

                await built.service.ask(ctx, item, proposalOf(), judgement)

                expect(built.open).not.toHaveBeenCalled()
                expect(built.markWaiting).toHaveBeenCalledWith("item-1", expect.objectContaining({ executionId: kept }))
            })
        })
    })
})
