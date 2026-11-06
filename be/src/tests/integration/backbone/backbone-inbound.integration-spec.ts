import assert from "node:assert/strict"
import { AgentWorkSettingsService } from "@modules/domain/agent-work"
import { ChatConversationsService, ChatMessagesService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import { API_APP_MODULES } from "../../world/api-app.options"
import { backboneInboundOf } from "../../world/backbone-inbound.service"
import { useTestWorld } from "../../world/use-test-world"
import {
    INBOUND_EVENT,
    INBOUND_HOLDING_REPLY,
    INBOUND_QUESTION,
    PAYMENT_AMOUNTS,
    receiptTextOf,
    UNSUPPORTED_INTENTS,
} from "../../fixtures/builders/backbone-inbound.builder"
import { readResultSchema } from "../../../modules/domain/agent-turns/intent-step.schema"
import { AgentWorkErrorCode } from "../../../modules/domain/agent-work/errors/agent-work.error"
import { linesOfWorkspace } from "../../world/agent-work-database.service"
import { expectRequestOf } from "../../world/backbone-inbound-assertions.service"

const world = useTestWorld({ modules: API_APP_MODULES })
const inbound = backboneInboundOf(world)
beforeAll(() => inbound.initialize())
beforeEach(() => inbound.seed())
afterEach(() => inbound.clean())

describe("backbone/webhook: signed receipt to persisted contract request", () => {
    it("valid signed event reaches its actual graph nodes and asks before writing", async () => {
        const event = await inbound.webhook("valid")
        assert(event !== null)
        await inbound.settle(await inbound.begin(event), receiptTextOf())
        await expectRequestOf(inbound, event)
    })

    it("signed payload claims cannot change endpoint workspace, source or the member behind the request", async () => {
        const owner = await inbound.owner()
        const event = await inbound.webhook("claimed-owner", true, {
            workspaceId: world.id(),
            adapter: "tag",
            authorUserId: inbound.who.userId,
            actorMemberId: owner.id,
            role: "owner",
        })
        assert(event !== null)
        const turn = await inbound.begin(event)
        expect(turn).toMatchObject({
            workspaceId: inbound.who.workspaceId,
            source: "generic_webhook",
            actorMemberId: null,
        })
        expect(turn.context.authorUserId).toBeUndefined()
        await inbound.settle(turn, receiptTextOf())
        await expectRequestOf(inbound, event)
    })

    it("missing payment amount remains a visible request and gains no authority", async () => {
        const event = await inbound.webhook("missing-amount")
        assert(event !== null)
        await inbound.settle(
            await inbound.begin(event),
            JSON.stringify({
                intent: "record_receivable_payment",
                result: { action: "record_receivable_payment", summary: "Verify a payment with no amount" },
            }),
        )
        const items = await inbound.items()
        expect(items).toHaveLength(1)
        expect(items[0]).toMatchObject({ status: "waiting_decision", result: null })
        expect(items[0]?.reasons).toContain("over_authority")
        expect(await inbound.replies()).toHaveLength(0)
    })

    it("forged signature writes no receipt, wake, work item or customer line", async () => {
        expect(await inbound.webhook("forged", false)).toBeNull()
        expect(await inbound.receipts()).toHaveLength(0)
        expect(await inbound.items()).toHaveLength(0)
        expect(await inbound.replies()).toHaveLength(0)
    })
})

describe("backbone/webhook: durable replay and recovery", () => {
    it("receipt and job redelivery keep one wake, one request and one execution of each step", async () => {
        const event = await inbound.webhook("duplicate")
        assert(event !== null)
        const turn = await inbound.begin(event)
        await inbound.settle(turn, receiptTextOf())
        await inbound.webhook("duplicate")
        await inbound.replay(turn, receiptTextOf(17_500_000))
        expect(await inbound.receipts()).toHaveLength(1)
        expect(await inbound.wakes(event)).toBe(1)
        await expectRequestOf(inbound, event)
    })

    it("worker loss after the committed read reuses that text and requests its action once", async () => {
        const event = await inbound.webhook("crash-after-read")
        assert(event !== null)
        const first = await inbound.begin(event)
        await inbound.read(first, event, receiptTextOf())
        const recovered = await inbound.recover(first, event)
        expect(recovered.fence).toBeGreaterThan(first.fence)
        expect(await inbound.replay(first, receiptTextOf())).toMatchObject({ status: "skipped", reason: "stale" })
        expect(await inbound.items()).toHaveLength(0)
        await inbound.settle(recovered, receiptTextOf(17_500_000))
        await expectRequestOf(inbound, event)
    })

    it("worker loss after the text commit resumes the stored text before reading and requesting once", async () => {
        const event = await inbound.webhook("crash-after-text")
        assert(event !== null)
        const first = await inbound.begin(event)
        expect(await inbound.storeText(first, event, receiptTextOf())).toBe(receiptTextOf())
        expect((await inbound.trace(event))?.steps).toHaveLength(1)
        expect((await inbound.trace(event))?.run.status).toBe("running")
        const recovered = await inbound.recover(first, event)
        expect(recovered.fence).toBeGreaterThan(first.fence)
        await inbound.settle(recovered, receiptTextOf(17_500_000))
        await expectRequestOf(inbound, event)
    })

    it.each([
        { name: "maximum sender key", key: "x".repeat(200) },
        { name: "Unicode sender key", key: String.fromCodePoint(0x0111).repeat(200) },
    ])("$name reaches the real door and remains one fact on replay", async ({ key }) => {
        const event = await inbound.webhook(key)
        assert(event !== null)
        expect(Buffer.byteLength(event.idempotencyKey, "utf8")).toBeLessThanOrEqual(200)
        await inbound.settle(await inbound.begin(event), receiptTextOf())
        expect((await inbound.webhook(key))?.idempotencyKey).toBe(event.idempotencyKey)
        expect(await inbound.wakes(event)).toBe(1)
        expect(await inbound.receipts()).toHaveLength(1)
        await expectRequestOf(inbound, event)
    })

    it("a newly published version cannot overwrite the version and committed read of an existing run", async () => {
        const event = await inbound.webhook("changed-plan")
        assert(event !== null)
        const turn = await inbound.begin(event)
        await inbound.read(turn, event, receiptTextOf())
        await inbound.publishAlternative()
        expect((await inbound.planOf(event))?.versionId).not.toBe(inbound.who.versionId)
        await expect(inbound.read(turn, event, receiptTextOf(17_500_000))).rejects.toMatchObject({
            code: "AGENT_RUNS_PLAN_CONFLICT",
        })
        const trace = await inbound.trace(event)
        expect(trace?.run.versionId).toBe(inbound.who.versionId)
        expect(trace?.steps).toHaveLength(2)
        const read = readResultSchema.parse(trace?.steps.find((step) => step.kind === "read_result")?.result)
        expect(read.trace.versionId).toBe(inbound.who.versionId)
        expect(await inbound.items()).toHaveLength(0)
    })
})

describe("backbone/webhook: registered source and workspace boundaries", () => {
    it("an unregistered event has no contract and cannot turn parsed identity into authority", async () => {
        const event = inbound.eventOf("unknown-event", { adapter: "generic_webhook", eventType: "unknown.payment" })
        await inbound.deliver(event)
        expect(await inbound.planOf(event)).toBeNull()
        expect(await inbound.settle(await inbound.begin(event), receiptTextOf())).toMatchObject({
            status: "skipped",
            reason: "no_contract",
        })
        expect(await inbound.items()).toHaveLength(0)
        expect((await inbound.trace(event))?.steps).toHaveLength(0)
    })

    it("an unregistered adapter is refused before any wake or effect", async () => {
        const event = inbound.eventOf("unknown-adapter", { adapter: "plugin_unknown", eventType: INBOUND_EVENT })
        await expect(inbound.deliver(event)).rejects.toMatchObject({ code: "AGENT_INBOUND_ADAPTER_UNKNOWN" })
        expect(await inbound.wakes(event)).toBe(0)
        expect(await inbound.items()).toHaveLength(0)
    })

    it("a registered source cannot address an agent of another workspace", async () => {
        const event = inbound.eventOf("cross-workspace", {
            adapter: "generic_webhook",
            eventType: INBOUND_EVENT,
            workspaceId: world.id(),
        })
        await expect(inbound.deliver(event)).rejects.toMatchObject({ code: AgentWorkErrorCode.AgentNotFound })
        expect(await inbound.wakes(event)).toBe(0)
        expect(await inbound.items()).toHaveLength(0)
    })
})

describe("backbone/tags-and-images: authority remains with actual contracts", () => {
    it("a real member tag and a webhook use the same published turn and action nodes", async () => {
        const owner = await inbound.owner()
        const tag = inbound.eventOf("member", { actor: { kind: "member", id: owner.id, role: "owner" } })
        await inbound.deliver(tag)
        await inbound.settle(await inbound.begin(tag), receiptTextOf())
        await expectRequestOf(inbound, tag)
    })

    it.each(PAYMENT_AMOUNTS)(
        "image/$name remains an approval request with its exact amount",
        async ({ name, amount }) => {
            const event = inbound.eventOf(`image-${name}`, {
                attachments: [{ fileId: world.id(), mimeType: "image/jpeg" }],
                evidence: [{ key: "amount_vnd", value: amount, kind: "money", via: "image" }],
            })
            await inbound.deliver(event)
            const turn = await inbound.begin(event)
            expect(turn.context.inbound?.length).toBeGreaterThan(200)
            await inbound.settle(turn, receiptTextOf(amount))
            await expectRequestOf(inbound, event, amount)
        },
    )

    it.each(UNSUPPORTED_INTENTS)("unsupported %s stays visible and performs no action", async (intent) => {
        const event = inbound.eventOf(`unsupported-${intent}`)
        await inbound.deliver(event)
        await inbound.settle(
            await inbound.begin(event),
            JSON.stringify({ intent, result: { action: intent, summary: "Unregistered action" } }),
        )
        const trace = await inbound.trace(event)
        const read = readResultSchema.parse(trace?.steps.find((step) => step.kind === "read_result")?.result)
        expect(read.trace).toMatchObject({ result: "invalid_output", detail: "unknown_intent", intent })
        expect(await inbound.items()).toHaveLength(0)
    })

    it("the actual chain limit writes no wake and tells a person once in Office", async () => {
        const event = inbound.eventOf("agent-loop", {
            chain: { id: world.id(), depth: 4, agentIds: [inbound.who.agentId], cause: null },
        })
        expect(await inbound.deliver(event)).toEqual({ accepted: false, agentIds: [] })
        await inbound.deliver(event)
        expect(await inbound.wakes(event)).toBe(0)
        expect(await inbound.items()).toHaveLength(0)
        expect(await linesOfWorkspace(world.db.primary, inbound.who.workspaceId)).toHaveLength(1)
    })

    it("a customer image has no implicit payment contract or payment effect", async () => {
        const event = inbound.eventOf("customer-image", {
            adapter: "customer",
            eventType: "customer_message",
            evidence: [{ key: "amount_vnd", value: 17_500_000, kind: "money", via: "image" }],
        })
        await inbound.deliver(event)
        expect(await inbound.planOf(event)).toBeNull()
        expect(await inbound.settle(await inbound.begin(event), receiptTextOf(17_500_000))).toMatchObject({
            status: "skipped",
            reason: "no_contract",
        })
        expect(await inbound.items()).toHaveLength(0)
    })
})

describe("backbone/chat: the customer conversation is a record of its workspace", () => {
    it("is read and answered inside its own workspace scope and found by no other workspace", async () => {
        const conversations = world.resolve(ChatConversationsService)
        const messages = world.resolve(ChatMessagesService)
        const { workspaceId, conversationId, messageId } = inbound.who

        await expect(conversations.targetOf(workspaceId, conversationId)).resolves.toMatchObject({
            kind: "ok",
            value: { id: conversationId, channel: "website", workspaceId },
        })
        await expect(messages.find(workspaceId, conversationId, messageId)).resolves.toMatchObject({
            kind: "ok",
            value: { id: messageId, role: "user", body: INBOUND_QUESTION },
        })
        await expect(conversations.targetOf(world.id(), conversationId)).resolves.toEqual({
            kind: "refused",
            code: ChatRecordsErrorCode.NotFound,
        })
        await expect(messages.find(world.id(), conversationId, messageId)).resolves.toEqual({
            kind: "refused",
            code: ChatRecordsErrorCode.NotFound,
        })
    })
})

describe("backbone/runtime: keyless runtime and kill switch", () => {
    it("runtime down on arrival stores an honest holding reply once for the real customer message", async () => {
        const event = inbound.eventOf("runtime-down", {
            adapter: "customer",
            eventType: "customer_message",
            payload: {
                conversationId: inbound.who.conversationId,
                messageId: inbound.who.messageId,
                channelEventId: `website:${inbound.who.messageId}`,
            },
            scopeKey: `conversation:${inbound.who.conversationId}`,
        })
        await inbound.deliver(event)
        const turn = await inbound.begin(event)
        const ending = await inbound.runtimeDown(turn)
        const [waiting] = await inbound.items()
        assert(waiting !== undefined)
        await inbound.holdAgain(turn)
        expect(ending).toMatchObject({ status: "done", reason: "openclaw_not_configured", outcome: { heldOver: true } })
        const replies = await inbound.replies()
        expect(replies).toHaveLength(1)
        expect(replies[0]?.body).toBe(INBOUND_HOLDING_REPLY)
        expect(await inbound.replyTo(inbound.who.messageId)).toBe(true)
        const requests = await inbound.items()
        expect(requests).toHaveLength(1)
        expect(requests[0]).toMatchObject({
            id: waiting.id,
            workspaceId: inbound.who.workspaceId,
            subjectType: "conversation",
            subjectId: inbound.who.conversationId,
            action: "reply_customer",
            status: "waiting_decision",
            reason: "unclear_outcome",
            dedupeKey: `reply_customer:message:${inbound.who.messageId}`,
            executionId: null,
            completedAt: null,
            result: null,
            proposal: {
                summary: INBOUND_QUESTION,
                draft: "",
                fields: { conversation_id: inbound.who.conversationId, question: INBOUND_QUESTION },
                execution: { forceAsk: "unclear_outcome", noChain: true, preset: true },
            },
        })
    })

    it("work switched off retains the event without running any pipeline step", async () => {
        await world
            .resolve(AgentWorkSettingsService)
            .setWorkspaceWork(inbound.who.userId, inbound.who.workspaceId, false)
        const event = inbound.eventOf("stopped", { adapter: "generic_webhook", eventType: INBOUND_EVENT })
        await inbound.deliver(event)
        expect(await inbound.tryBegin(event)).toMatchObject({
            result: "killed",
            ended: [expect.objectContaining({ state: "held" })],
        })
        expect(await inbound.wakes(event)).toBe(1)
        expect((await inbound.trace(event))?.steps).toHaveLength(0)
        expect(await inbound.items()).toHaveLength(0)
    })
})
