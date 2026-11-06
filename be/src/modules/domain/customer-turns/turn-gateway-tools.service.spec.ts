import {
    CTX,
    CONVERSATION,
    CALLER,
    DESCRIBED,
    READ,
    PRICE_LIST,
    ORDER_SOURCE,
    SEQUENCE_STEPS,
    arrangeTurnGateway,
    APPROVAL_SPEC,
    SEQUENCE_ARGUMENT_CASES,
    INVALID_SEQUENCES,
    SEQUENCE_APPROVAL_SEED,
    roadOutputOf,
} from "@tests/fixtures/builders/turn-gateway-harness.builder"

import { ChatRecordsErrorCode } from "@modules/domain/chat-records"

import type { GatewayToolName } from "@modules/domain/agent-tools"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { OUTPUT_NODE_READER } from "@modules/domain/authority-rules"
import type { OutputNodeReader } from "@modules/domain/authority-rules"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HubNotesService } from "./hub-notes.service"
import { OutputApprovalService } from "./output-approval.service"
import { TurnGatewayPipelineService } from "./turn-gateway-pipeline.service"
import { TurnGatewayToolsService } from "./turn-gateway-tools.service"
import { TurnSourcesService } from "./turn-sources.service"

const build = async (refuses = false, includeNodes = true) => {
    const gateway = mock<McpGatewayService>()
    const conversations = mock<ChatConversationsService>()
    const approvals = mock<OutputApprovalService>()
    const notes = mock<HubNotesService>()
    const sources = mock<TurnSourcesService>()
    const pipeline = mock<TurnGatewayPipelineService>()
    const runs = mock<AgentRunsService>()
    const nodes = mock<OutputNodeReader>()
    const catalog = mock<MessageCatalog>({ get: (key, params) => key + " " + JSON.stringify(params ?? {}) })
    const doubles = { gateway, conversations, approvals, notes, sources, pipeline, runs, nodes, catalog }
    arrangeTurnGateway(doubles, refuses)
    const moduleRef = includeNodes
        ? await Test.createTestingModule({
              providers: [
                  TurnGatewayToolsService,
                  { provide: AgentRunsService, useValue: runs },
                  { provide: OUTPUT_NODE_READER, useValue: nodes },
                  { provide: TurnGatewayPipelineService, useValue: pipeline },
                  { provide: MESSAGE_CATALOG, useValue: catalog },
                  { provide: McpGatewayService, useValue: gateway },
                  { provide: ChatConversationsService, useValue: conversations },
                  { provide: OutputApprovalService, useValue: approvals },
                  { provide: HubNotesService, useValue: notes },
                  { provide: TurnSourcesService, useValue: sources },
              ],
          }).compile()
        : await Test.createTestingModule({
              providers: [
                  TurnGatewayToolsService,
                  { provide: AgentRunsService, useValue: runs },
                  { provide: TurnGatewayPipelineService, useValue: pipeline },
                  { provide: MESSAGE_CATALOG, useValue: catalog },
                  { provide: McpGatewayService, useValue: gateway },
                  { provide: ChatConversationsService, useValue: conversations },
                  { provide: OutputApprovalService, useValue: approvals },
                  { provide: HubNotesService, useValue: notes },
                  { provide: TurnSourcesService, useValue: sources },
              ],
          }).compile()
    return { service: moduleRef.get(TurnGatewayToolsService), ...doubles }
}

describe("TurnGatewayToolsService discovery", () => {
    it("searches the tools the conversation's agent may use, with a bounded limit", async () => {
        const { service, gateway } = await build()
        await expect(service.run(CTX, "tool.search", { query: " order ", limit: 3 })).resolves.toEqual({
            tools: [{ name: "crm.order.place", description: "", scope: "write", mode: "auto" }],
        })
        expect(gateway.search).toHaveBeenCalledWith(CALLER, "order", 3)
        await service.run(CTX, "tool.search", { query: "x" })
        expect(gateway.search.mock.calls.slice(1).map((call) => [call[1], call[2]])).toEqual([["x", 5]])
    })

    it("describes one granted tool, or says it is unknown or not granted", async () => {
        const { service, gateway } = await build()
        await expect(service.run(CTX, "tool.describe", { name: "crm.order.place" })).resolves.toEqual(DESCRIBED)
        gateway.describe.mockResolvedValueOnce(null)
        await expect(service.run(CTX, "tool.describe", { name: "crm.secret" })).resolves.toEqual({
            error: "not_granted_or_unknown",
        })
    })

    it("answers not found for a conversation the workspace of the job does not have, and calls nothing", async () => {
        const { service, gateway, conversations } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "refused", code: ChatRecordsErrorCode.NotFound })
        await expect(service.run(CTX, "tool.search", { query: "x" })).resolves.toEqual({
            error: "conversation_not_found",
        })
        expect(conversations.turnOf).toHaveBeenCalledWith(CTX.workspaceId, "c1")
        expect(gateway.search).not.toHaveBeenCalled()
        expect(gateway.call).not.toHaveBeenCalled()
    })
})

describe("TurnGatewayToolsService argument validation", () => {
    const INVALID: ReadonlyArray<{ readonly tool: GatewayToolName; readonly args: Readonly<Record<string, unknown>> }> =
        [
            { tool: "tool.search", args: { query: "q".repeat(201) } },
            { tool: "tool.search", args: { query: 4, limit: 0.5 } },
            { tool: "tool.search", args: { query: "x", limit: 11 } },
            { tool: "tool.search", args: { query: "x", limit: 0 } },
            { tool: "tool.search", args: { query: "x", limit: "2" } },
            { tool: "tool.describe", args: { name: "n".repeat(114) } },
            { tool: "tool.describe", args: { name: 4 } },
            { tool: "tool.describe", args: {} },
            { tool: "tool.call", args: { name: "n".repeat(114) } },
            { tool: "tool.call", args: { name: "crm.stock.read", arguments_json: " ".repeat(65537) } },
            { tool: "tool.call", args: { name: "crm.stock.read", arguments_json: {} } },
            { tool: "tool.sequence", args: { steps_json: [] } },
            { tool: "tool.sequence", args: { steps_json: " ".repeat(655361) } },
            { tool: "tool.sequence", args: { steps_json: "[]", reply: "r".repeat(2001) } },
            { tool: "tool.sequence", args: { steps_json: "[]", reply: 7 } },
        ]

    it.each(INVALID)(
        "refuses invalid $tool arguments before reaching the gateway or opening an approval",
        async ({ tool, args }) => {
            const { service, gateway, approvals } = await build()
            await expect(service.run(CTX, tool, args)).resolves.toEqual({ error: "invalid_arguments" })
            expect(gateway.search).not.toHaveBeenCalled()
            expect(gateway.describe).not.toHaveBeenCalled()
            expect(gateway.call).not.toHaveBeenCalled()
            expect(approvals.ask).not.toHaveBeenCalled()
        },
    )
})

describe("TurnGatewayToolsService write retries", () => {
    it("replays a HAKUEN write with reordered nested arguments without acting twice", async () => {
        const { service, gateway } = await build()
        const executed = new Set<string | undefined>()
        gateway.call.mockImplementation((caller) => {
            executed.add(caller.opKey)
            return Promise.resolve({ ok: true, value: { holdId: "h1" } })
        })
        const name = "hakuen.booking.hold"
        const first = JSON.stringify({ room: "deluxe", guest: { name: "Lan", party: 2 }, extras: ["spa", "onsen"] })
        const reordered = JSON.stringify({ extras: ["spa", "onsen"], guest: { party: 2, name: "Lan" }, room: "deluxe" })

        await expect(service.run(CTX, "tool.call", { name, arguments_json: first })).resolves.toEqual({
            result: { holdId: "h1" },
        })
        await expect(service.run(CTX, "tool.call", { name, arguments_json: reordered })).resolves.toEqual({
            result: { holdId: "h1" },
        })

        expect(executed.size).toBe(1)

        await service.run({ ...CTX, jobId: "m2" }, "tool.call", { name, arguments_json: first })
        await service.run(CTX, "tool.call", {
            name,
            arguments_json: JSON.stringify({
                room: "suite",
                guest: { name: "Lan", party: 2 },
                extras: ["spa", "onsen"],
            }),
        })
        await service.run(CTX, "tool.call", {
            name,
            arguments_json: JSON.stringify({
                room: "deluxe",
                guest: { name: "Lan", party: 2 },
                extras: ["onsen", "spa"],
            }),
        })
        expect(executed.size).toBe(4)
    })
})

describe("TurnGatewayToolsService call cards", () => {
    it("calls the tool as the agent under a step key of the inbound message and posts the done card of a write", async () => {
        const { service, gateway, notes, sources } = await build()
        await expect(
            service.run(CTX, "tool.call", { name: "crm.order.place", arguments_json: '{"sku":"a","qty":2}' }),
        ).resolves.toEqual({ result: { orderId: "o1" } })
        await service.run(CTX, "tool.call", { name: "crm.order.place", arguments_json: '{"sku":"b"}' })
        await service.run(CTX, "tool.call", { name: "crm.order.place", arguments_json: '{"sku":"a","qty":2}' })
        const keys = gateway.call.mock.calls.map((call) => call[0].opKey)
        expect(keys[0]).toMatch(/^m1:crm\.order\.place:[0-9a-f]{16}$/u)
        expect(keys[1]).not.toBe(keys[0])
        expect(keys[2]).toBe(keys[0])
        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject(CALLER)
        expect(gateway.call.mock.calls[0]?.[2]).toEqual({ sku: "a", qty: 2 })
        expect(sources.of).toHaveBeenCalledWith("m1")
        expect(notes.postOnce.mock.calls[0]).toEqual([
            {
                workspaceId: "ws",
                room: "",
                type: "action_done",
                title: 'gatewayTurns.cardActionDone {"what":"Place an order"}',
                fields: [
                    { label: "gatewayTurns.field.tool {}", value: "crm.order.place" },
                    { label: "gatewayTurns.field.customer {}", value: "Lan" },
                ],
                authorName: "AI Sales",
                sources: [ORDER_SOURCE, ...PRICE_LIST],
            },
            "sales",
            { leadId: "l1", workItemId: null },
            gateway.call.mock.calls[0]?.[0].opKey,
        ])
    })

    it("names a write by its tool when it has no description, and an unnamed customer as empty", async () => {
        const { service, gateway, notes, conversations } = await build()
        gateway.describe.mockResolvedValueOnce({ ...DESCRIBED, description: "" })
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, visitorName: null } })
        await service.run(CTX, "tool.call", { name: "crm.order.place" })
        expect(gateway.call.mock.calls[0]?.[2]).toEqual({})
        expect(notes.postOnce.mock.calls[0]?.[0].title).toContain('"what":"crm.order.place"')
        expect(notes.postOnce.mock.calls[0]?.[0].fields[1]?.value).toBe("")
    })

    it("posts no card for a read, nor for a tool the agent may not describe", async () => {
        const { service, gateway, notes } = await build()
        gateway.describe.mockResolvedValueOnce(READ).mockResolvedValueOnce(null)
        await service.run(CTX, "tool.call", { name: "crm.stock.read" })
        await service.run(CTX, "tool.call", { name: "crm.hidden" })
        expect(gateway.call).toHaveBeenCalledTimes(2)
        expect(notes.postOnce).not.toHaveBeenCalled()
    })
})

describe("TurnGatewayToolsService call arguments and refusals", () => {
    it("refuses arguments that are no JSON object before calling anything", async () => {
        const { service, gateway } = await build()
        for (const text of ["nope", "[1]", "null", JSON.stringify({ text: "x".repeat(8193) })]) {
            await expect(
                service.run(CTX, "tool.call", { name: "crm.order.place", arguments_json: text }),
            ).resolves.toEqual({
                error: "invalid_arguments",
                detail: "arguments_json is not a JSON object",
            })
        }
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("keeps a blank encoded arguments field as the absent object", async () => {
        const { service, gateway } = await build()
        await service.run(CTX, "tool.call", { name: "crm.stock.read", arguments_json: " " })
        expect(gateway.call.mock.calls[0]?.[2]).toEqual({})
    })

    it("answers a failed call as it is and opens no approval", async () => {
        const { service, gateway, approvals, notes } = await build()
        gateway.call.mockResolvedValueOnce({ ok: false, code: "tool_error", detail: "out of stock" })
        await expect(service.run(CTX, "tool.call", { name: "crm.order.place" })).resolves.toEqual({
            error: "tool_error",
            detail: "out of stock",
        })
        expect(approvals.ask).not.toHaveBeenCalled()
        expect(notes.postOnce).not.toHaveBeenCalled()
    })
})

describe("TurnGatewayToolsService approvals", () => {
    it("opens the gateway_call approval with the exact call and the turn's sources when a person must decide", async () => {
        const { service, gateway, approvals } = await build()
        gateway.call.mockResolvedValueOnce({ ok: false, code: "approval_required", reason: "over_limit_vnd" })
        await expect(
            service.run(CTX, "tool.call", { name: "crm.order.place", arguments_json: '{"sku":"a"}' }),
        ).resolves.toEqual({ status: "approval_requested", reason: "over_limit_vnd", work_item_id: "w1" })
        const [ctx, request] = approvals.ask.mock.calls[0] ?? []
        const spec = request?.spec
        expect(ctx).toEqual({ workspaceId: "ws", actor: "OpenClaw", locale: "vi" })
        expect(spec).toMatchObject(APPROVAL_SPEC)
        expect(spec?.dedupeKey).toBe(`gateway_call:${String(gateway.call.mock.calls[0]?.[0].opKey)}`)
    })

    it("names an unnamed customer with a dash on the approval", async () => {
        const { service, gateway, approvals, conversations } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, visitorName: null } })
        gateway.call.mockResolvedValueOnce({ ok: false, code: "approval_required", reason: "ask_mode" })
        await service.run(CTX, "tool.call", { name: "crm.order.place" })
        expect(approvals.ask.mock.calls[0]?.[1].spec.seed?.summary).toContain('"name":"-"')
        expect(approvals.ask.mock.calls[0]?.[1].spec.seed?.fields?.customer).toBe("")
    })
})

describe("TurnGatewayToolsService sequence", () => {
    it("keeps the same approval identity for reordered argument keys and a distinct identity for reordered steps", async () => {
        const { service, approvals } = await build()
        const { first, reordered } = SEQUENCE_ARGUMENT_CASES

        await service.run(CTX, "tool.sequence", { steps_json: JSON.stringify(first) })
        await service.run(CTX, "tool.sequence", { steps_json: JSON.stringify(reordered) })
        await service.run(CTX, "tool.sequence", { steps_json: JSON.stringify(reordered.toReversed()) })

        const keys = approvals.ask.mock.calls.map((call) => call[1].spec.dedupeKey)
        expect(keys[0]).toBe(keys[1])
        expect(keys[0]).not.toBe(keys[2])
    })

    it("holds a playbook's steps for one approval with the reply, the steps and the turn's sources, and calls nothing", async () => {
        const { service, gateway, approvals } = await build()
        gateway.describe.mockResolvedValueOnce(READ).mockResolvedValueOnce(DESCRIBED)
        await expect(
            service.run(CTX, "tool.sequence", { steps_json: SEQUENCE_STEPS, reply: " Done for you " }),
        ).resolves.toEqual({
            status: "approval_requested",
            reason: "playbook",
            work_item_id: "w1",
        })
        expect(gateway.call).not.toHaveBeenCalled()
        const spec = approvals.ask.mock.calls[0]?.[1].spec
        expect(spec?.dedupeKey).toMatch(/^gateway_call:m1:sequence:[0-9a-f]{16}$/u)
        expect(spec?.seed).toMatchObject(SEQUENCE_APPROVAL_SEED)
    })

    it("holds a step that names no arguments with an empty object for them", async () => {
        const { service, gateway, approvals } = await build()
        gateway.describe.mockResolvedValue(READ)
        await expect(
            service.run(CTX, "tool.sequence", { steps_json: JSON.stringify([{ name: "crm.stock.read" }]) }),
        ).resolves.toMatchObject({ status: "approval_requested" })
        expect(approvals.ask.mock.calls[0]?.[1].spec.seed?.fields?.steps_json).toBe(
            JSON.stringify([{ name: "crm.stock.read", arguments: {} }]),
        )
    })

    it("tells the customer the approved line when the agent gave no reply", async () => {
        const { service, approvals } = await build()
        await service.run(CTX, "tool.sequence", { steps_json: SEQUENCE_STEPS })
        expect(approvals.ask.mock.calls[0]?.[1].spec.seed?.draft).toBe("gatewayTurns.approvedDone {}")
    })
})

describe("TurnGatewayToolsService sequence validation", () => {
    it("refuses steps that are no valid list, or name a tool the agent may not use", async () => {
        const { service, gateway, approvals } = await build()
        await expect(service.run(CTX, "tool.sequence", { steps_json: "[]" })).resolves.toEqual({
            error: "invalid_steps",
            detail: "steps_json is a list of 1 to 10 bounded calls",
        })
        gateway.describe.mockResolvedValueOnce(READ).mockResolvedValueOnce(null)
        await expect(service.run(CTX, "tool.sequence", { steps_json: SEQUENCE_STEPS })).resolves.toEqual({
            error: "not_granted_or_unknown",
            detail: "crm.order.place",
        })
        expect(approvals.ask).not.toHaveBeenCalled()
    })

    it("refuses malformed JSON, too many steps, and invalid step fields before describing or approving", async () => {
        const { service, gateway, approvals } = await build()
        const invalid = INVALID_SEQUENCES
        for (const steps of invalid) {
            await expect(service.run(CTX, "tool.sequence", { steps_json: steps })).resolves.toEqual({
                error: "invalid_steps",
                detail: "steps_json is a list of 1 to 10 bounded calls",
            })
        }
        expect(gateway.describe).not.toHaveBeenCalled()
        expect(approvals.ask).not.toHaveBeenCalled()
    })
})

describe("TurnGatewayToolsService on the contract pipeline", () => {
    it("refuses a write of a turn that is not pinned and calls nothing", async () => {
        const { service, gateway } = await build(true)

        await expect(service.run(CTX, "tool.call", { name: "crm.order.place" })).resolves.toEqual({
            error: "needs_own_turn",
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("refuses a playbook sequence of a turn that is not pinned", async () => {
        const { service, approvals } = await build(true)

        await expect(service.run(CTX, "tool.sequence", { steps_json: SEQUENCE_STEPS })).resolves.toEqual({
            error: "needs_own_turn",
        })
        expect(approvals.ask).not.toHaveBeenCalled()
    })

    it("leaves a tool that is not granted to the gateway to answer", async () => {
        const { service, gateway } = await build(true)
        gateway.describe.mockResolvedValue(null)
        gateway.call.mockResolvedValue({ ok: false, code: "not_granted", detail: "no" })

        await expect(service.run(CTX, "tool.call", { name: "crm.secret" })).resolves.toMatchObject({
            error: "not_granted",
        })
    })
})

const CORE_CTX = { ...CTX, wakeId: "wake-1" }
const CORE_CALL = { name: "crm.order.place", arguments_json: '{"sku":"a"}' }

describe("TurnGatewayToolsService on a run of the core road", () => {
    it("runs a write as an output step on the graph's node and answers the stored result", async () => {
        const { service, runs, gateway, notes } = await build()
        await expect(service.run(CORE_CTX, "tool.call", CORE_CALL)).resolves.toEqual({ result: { summary: "ORD-1" } })
        expect(runs.runInline).toHaveBeenCalledWith(
            "ws",
            "wake-1",
            expect.objectContaining({ kind: "output", nodeKey: "act:gateway_call" }),
            expect.any(AbortSignal),
        )
        expect(gateway.call).not.toHaveBeenCalled()
        expect(notes.postOnce).toHaveBeenCalledTimes(1)
    })

    it("answers a failed output as it came to", async () => {
        const { service, runs, notes } = await build()
        runs.runInline.mockResolvedValue(roadOutputOf("failed"))
        await expect(service.run(CORE_CTX, "tool.call", CORE_CALL)).resolves.toEqual({ error: "ask_mode", detail: "" })
        expect(notes.postOnce).not.toHaveBeenCalled()
    })

    it("holds a call a person must decide on a wait step that keeps the exact call", async () => {
        const { service, runs, approvals } = await build()
        runs.runInline.mockResolvedValueOnce(roadOutputOf("held"))
        await expect(service.run(CORE_CTX, "tool.call", CORE_CALL)).resolves.toMatchObject({
            status: "approval_requested",
        })
        expect(approvals.ask.mock.calls[0]?.[1]?.spec.seed?.fields).toMatchObject({ in_run: "true", message_id: "m1" })
        expect(approvals.ask.mock.calls[0]?.[1]?.wait).toMatchObject({
            wakeId: "wake-1",
            calls: [{ tool: "crm.order.place", argsJson: '{"sku":"a"}' }],
            scope: { approvalNode: "ask:gateway_call", messageId: "m1" },
        })
        expect(runs.runInline).toHaveBeenCalledTimes(1)
    })

    it("leaves a read to the gateway: it changes nothing a retry could repeat", async () => {
        const { service, runs, gateway } = await build()
        gateway.describe.mockResolvedValue(READ)
        await service.run(CORE_CTX, "tool.call", { name: "crm.stock.read" })
        expect(runs.runInline).not.toHaveBeenCalled()
    })
})

describe("TurnGatewayToolsService incomplete stored outcomes without graph bindings", () => {
    it("keeps an unread outcome and absent refusal reasons explicit while using empty optional graph nodes", async () => {
        const { service, runs, approvals } = await build(false, false)
        runs.runInline.mockResolvedValueOnce({})
        await expect(service.run(CORE_CTX, "tool.call", CORE_CALL)).resolves.toEqual({ error: "unknown_outcome" })
        runs.runInline.mockResolvedValueOnce(roadOutputOf("failed", null))
        await expect(service.run(CORE_CTX, "tool.call", CORE_CALL)).resolves.toEqual({ error: "failed", detail: "" })
        runs.runInline.mockResolvedValueOnce(roadOutputOf("held", null))
        await expect(service.run(CORE_CTX, "tool.call", CORE_CALL)).resolves.toMatchObject({
            status: "approval_requested",
            reason: "",
        })
        expect(approvals.ask.mock.calls[0]?.[1].spec.seed?.fields?.reason).toBe("")
        expect(runs.runInline.mock.calls[0]?.[2].nodeKey).toBe("")
    })
})
