import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeTurn } from "@modules/domain/graph-nodes"
import { ChatConversationsService } from "@modules/domain/chat-records"
import type { ChatHumanConversation } from "@modules/domain/chat-records"
import { ProviderAbilitiesService } from "./provider-abilities.service"
import { TOOL } from "@nivo-lite/blocks-core"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphNodeRunTokensService, GraphNodesErrorCode, toolFingerprintOf } from "@modules/domain/graph-nodes"
import type { NodeRunClaims, NodeToolCall } from "@modules/domain/graph-nodes"
import { AgentViewScopeService } from "@modules/domain/agents"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { McpGatewayService } from "./mcp-gateway.service"
import type { GatewayCallResult } from "./mcp-gateway.contracts"
import { NodeToolDoorService } from "./node-tool-door.service"

const ARGS = { orderNo: "DH-7", amountVnd: 5000, transferContent: "DH7 thanh toan" }

const CLAIMS: NodeRunClaims = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    runId: "run-1",
    conversationId: "conv-1",
    origin: "system",
    memberId: null,
    scope: "workspace",
    expiresAt: 9_999_999_999_999,
}

const callOf = (overrides: Partial<NodeToolCall> = {}): NodeToolCall => ({
    token: "token-1",
    tool: "bank.transactions",
    args: ARGS,
    key: "step-1",
    approval: null,
    ...overrides,
})

const STEWARD = { seat_id: "member-owner", id: "user-1", name: "Lan", at: "2026-11-01T00:00:00.000Z" }

const build = async (
    claims: NodeRunClaims | null = CLAIMS,
    result: GatewayCallResult = { ok: true, value: {} },
    scopes?: AgentViewScopeService,
) => {
    const gateway = mock<McpGatewayService>()
    gateway.call.mockResolvedValue(result)
    const tokens = mock<GraphNodeRunTokensService>()
    tokens.verify.mockReturnValue(claims)
    const members = mock<WorkspaceMembersReadService>()
    members.firstStewards.mockResolvedValue([STEWARD])
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeToolDoorService,
            { provide: McpGatewayService, useValue: gateway },
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: WorkspaceMembersReadService, useValue: members },
            { provide: LOGGER, useValue: logger },
            ...(scopes === undefined ? [] : [{ provide: AgentViewScopeService, useValue: scopes }]),
        ],
    }).compile()
    return { door: moduleRef.get(NodeToolDoorService), gateway, tokens, members, logger }
}

/** The door where no workspace members service is bound. */
const buildWithoutMembers = async (claims: NodeRunClaims) => {
    const gateway = mock<McpGatewayService>()
    gateway.call.mockResolvedValue({ ok: true, value: {} })
    const tokens = mock<GraphNodeRunTokensService>()
    tokens.verify.mockReturnValue(claims)
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeToolDoorService,
            { provide: McpGatewayService, useValue: gateway },
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { door: moduleRef.get(NodeToolDoorService), gateway }
}

describe("NodeToolDoorService who calls", () => {
    it("calls as the run its token names, under the replay key, and answers the value", async () => {
        const value = { provider: "sepay", qrUrl: "https://qr.example/img" }
        const { door, gateway, tokens } = await build(CLAIMS, { ok: true, value })

        await expect(door.call(callOf())).resolves.toEqual(value)

        expect(tokens.verify).toHaveBeenCalledWith("token-1")
        expect(gateway.call).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                conversationId: "conv-1",
                workItemId: null,
                opKey: "step-1",
                turnId: "run-1",
                audience: "internal",
                graphStep: true,
            },
            "bank.transactions",
            ARGS,
        )
    })

    it("refuses a call without a valid run token before anything is reached", async () => {
        const { door, gateway } = await build(null)

        await expect(door.call(callOf())).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolTokenInvalid,
            params: { tool: "bank.transactions" },
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("carries the graph step the token signs, which the NIVO effect tools need", async () => {
        const claims = {
            ...CLAIMS,
            locale: "vi" as const,
            handedOffBy: "agent-0",
            leadId: null,
            stepTools: ["order.create"],
        }
        const { door, gateway } = await build(claims)

        await door.call(callOf())

        expect(gateway.call.mock.calls[0]?.[0].run).toEqual({
            turnId: "run-1",
            locale: "vi",
            origin: CLAIMS.origin,
            memberId: CLAIMS.memberId,
            handedOffBy: "agent-0",
            leadId: null,
            stepTools: ["order.create"],
        })
    })

    it("carries no step for a token that signs none", async () => {
        const { door, gateway } = await build(CLAIMS)

        await door.call(callOf())

        expect(gateway.call.mock.calls[0]?.[0].run).toBeUndefined()
    })

    it("calls a customer's run as the customer audience", async () => {
        const { door, gateway } = await build({ ...CLAIMS, origin: "customer", scope: "public" })

        await door.call(callOf())

        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject({ audience: "customer" })
    })

    it("calls a customer-started run as its agent's own audience: internal for an accounting step, the customer's for a front-desk step or an agent it cannot read", async () => {
        const scopes = mock<AgentViewScopeService>()
        const started: NodeRunClaims = { ...CLAIMS, origin: "customer", scope: "public" }
        const { door, gateway } = await build(started, { ok: true, value: {} }, scopes)

        scopes.lensOf.mockResolvedValueOnce({ module: "accounting", installationId: null })
        await door.call(callOf())
        scopes.lensOf.mockResolvedValueOnce({ module: "chatbot", installationId: null })
        await door.call(callOf())
        scopes.lensOf.mockResolvedValueOnce(null)
        await door.call(callOf())

        expect(scopes.lensOf).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(
            gateway.call.mock.calls.map(([caller]) => [caller.audience, caller.conversationId, caller.graphStep]),
        ).toEqual([
            ["internal", "conv-1", true],
            ["customer", "conv-1", true],
            ["customer", "conv-1", true],
        ])
    })

    it("never reads the agent for a run of the workspace: it is internal", async () => {
        const scopes = mock<AgentViewScopeService>()
        const { door, gateway } = await build(CLAIMS, { ok: true, value: {} }, scopes)

        await door.call(callOf())

        expect(scopes.lensOf).not.toHaveBeenCalled()
        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject({ audience: "internal", graphStep: true })
    })

    it("lets an owner or manager's turn call, and refuses any other member's turn unless a person approved it", async () => {
        const owner = await build({ ...CLAIMS, origin: "owner", memberId: "member-owner" })
        const staff = await build({ ...CLAIMS, origin: "staff", memberId: "member-staff" })
        const approval = { by: "member-owner", fingerprint: toolFingerprintOf("bank.transactions", ARGS) }

        await expect(owner.door.call(callOf())).resolves.toEqual({})
        await expect(staff.door.call(callOf())).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolFailed,
            params: { reason: "member_not_allowed" },
        })
        await expect(staff.door.call(callOf({ approval }))).resolves.toEqual({})
        expect(owner.members.firstStewards).toHaveBeenCalledWith("ws-1", 50)
    })
})

describe("NodeToolDoorService without the workspace members", () => {
    it("refuses the turn of a member, since nobody can say who owns the workspace, and still lets a run no person stands behind call", async () => {
        const member = await buildWithoutMembers({ ...CLAIMS, origin: "owner", memberId: "member-owner" })
        const system = await buildWithoutMembers(CLAIMS)

        await expect(member.door.call(callOf())).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolFailed,
            params: { reason: "member_not_allowed" },
        })
        expect(member.gateway.call).not.toHaveBeenCalled()
        await expect(system.door.call(callOf())).resolves.toEqual({})
    })
})

describe("NodeToolDoorService approvals", () => {
    it("asks for a person with the fingerprint of the exact tool and arguments", async () => {
        const { door } = await build(CLAIMS, { ok: false, code: "approval_required", reason: "ask_mode" })

        await expect(door.call(callOf({ tool: "ledger.append" }))).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: {
                tool: "ledger.append",
                fingerprint: toolFingerprintOf("ledger.append", ARGS),
                reason: "ask_mode",
                args: JSON.stringify({ orderNo: "DH-7", amountVnd: "5000", transferContent: "DH7 thanh toan" }),
            },
        })
    })

    it("runs a call that replays an approval of its fingerprint as approved by that person", async () => {
        const { door, gateway } = await build()
        const approval = { by: "member-owner", fingerprint: toolFingerprintOf("bank.transactions", ARGS) }

        await door.call(callOf({ approval }))

        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject({ approvedBy: "member-owner" })
    })

    it("asks again when the arguments changed after the approval", async () => {
        const { door, gateway } = await build()
        const approval = { by: "member-owner", fingerprint: toolFingerprintOf("bank.transactions", ARGS) }

        await door.call(callOf({ approval, args: { ...ARGS, amountVnd: 9000 } }))

        expect(gateway.call.mock.calls[0]?.[0]).not.toHaveProperty("approvedBy")
    })
})

describe("NodeToolDoorService failures", () => {
    it.each([
        [
            "no provider",
            { ok: false, code: "tool_error", detail: '{"error":"not_connected"}' },
            GraphNodesErrorCode.ToolNotConnected,
        ],
        [
            "a refused connection",
            { ok: false, code: "tool_error", detail: '{"error":"connection_refused"}' },
            GraphNodesErrorCode.ToolConnectionRefused,
        ],
        [
            "another tool error",
            { ok: false, code: "tool_error", detail: '{"error":"internal_only"}' },
            GraphNodesErrorCode.ToolFailed,
        ],
        [
            "a grant it lacks",
            { ok: false, code: "not_granted", detail: "bank.transactions" },
            GraphNodesErrorCode.ToolNotGranted,
        ],
        [
            "a data right it lacks",
            { ok: false, code: "not_granted", detail: "no_data_right" },
            GraphNodesErrorCode.ToolNotGranted,
        ],
        ["an unavailable provider", { ok: false, code: "unavailable", detail: "x" }, GraphNodesErrorCode.ToolFailed],
    ] satisfies ReadonlyArray<readonly [string, GatewayCallResult, GraphNodesErrorCode]>)(
        "answers the typed error for %s",
        async (_name, result, code) => {
            const { door } = await build(CLAIMS, result)

            await expect(door.call(callOf())).rejects.toMatchObject({ code, params: { tool: "bank.transactions" } })
        },
    )

    it("refuses arguments that are not a bounded JSON record before it calls the gateway", async () => {
        const { door, gateway } = await build()

        await expect(door.call(callOf({ args: { at: () => 1 } }))).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolFailed,
            params: { reason: "invalid_arguments" },
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})

describe("NodeToolDoorService failure log", () => {
    it("names a missing tool grant apart from a missing data right, and logs the refusal with its cause", async () => {
        const { door, logger } = await build(CLAIMS, { ok: false, code: "not_granted", detail: "bank.transactions" })

        await expect(door.call(callOf())).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolNotGranted,
            params: { tool: "bank.transactions", reason: "no_tool_grant" },
        })
        expect(logger.warn).toHaveBeenCalledWith("mcp-gateway.node-tool.failed", {
            workspaceId: "ws-1",
            agentId: "agent-1",
            runId: "run-1",
            tool: "bank.transactions",
            code: GraphNodesErrorCode.ToolNotGranted,
            gatewayCode: "not_granted",
            reason: "no_tool_grant",
        })
    })

    it("logs a refusal before the gateway too, and never an approval to ask", async () => {
        const staff = await build({ ...CLAIMS, origin: "staff", memberId: "member-staff" })
        const asking = await build(CLAIMS, { ok: false, code: "approval_required", reason: "ask_mode" })

        await expect(staff.door.call(callOf())).rejects.toMatchObject({ code: GraphNodesErrorCode.ToolFailed })
        await expect(asking.door.call(callOf())).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolApprovalRequired,
        })

        expect(staff.logger.warn).toHaveBeenCalledWith(
            "mcp-gateway.node-tool.failed",
            expect.objectContaining({ code: GraphNodesErrorCode.ToolFailed, reason: "member_not_allowed" }),
        )
        expect(asking.logger.warn).not.toHaveBeenCalled()
    })
})

/** The door with the provider rights bound, answering `verdict` for the run's agent. */
const buildWithAbilities = async (verdict: Awaited<ReturnType<ProviderAbilitiesService["judge"]>>) => {
    const gateway = mock<McpGatewayService>()
    const tokens = mock<GraphNodeRunTokensService>()
    tokens.verify.mockReturnValue(CLAIMS)
    const abilities = mock<ProviderAbilitiesService>()
    abilities.judge.mockResolvedValue(verdict)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeToolDoorService,
            { provide: McpGatewayService, useValue: gateway },
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: LOGGER, useValue: logger },
            { provide: ProviderAbilitiesService, useValue: abilities },
        ],
    }).compile()
    return { door: moduleRef.get(NodeToolDoorService), abilities, tokens, logger }
}

const QR = { token: "token-1", effect: TOOL.paymentQrCreate, payload: { orderId: "o-1" }, approval: null }

describe("NodeToolDoorService effect rights: the context.effect road", () => {
    it("judges payment.qr.create and payment.credit.rematch by the run agent's abilities, as the gateway road does", async () => {
        const { door, abilities } = await buildWithAbilities({
            kind: "allow",
            provider: "sepay",
            ability: "qr.create",
            connectionId: "conn-mb",
        })

        await expect(door.effectRight(QR)).resolves.toBeNull()
        await expect(door.effectRight({ ...QR, effect: TOOL.paymentRematch })).resolves.toBeNull()
        expect(abilities.judge).toHaveBeenNthCalledWith(
            1,
            CLAIMS.workspaceId,
            CLAIMS.agentId,
            TOOL.paymentQrCreate,
            false,
        )
        expect(abilities.judge).toHaveBeenNthCalledWith(
            2,
            CLAIMS.workspaceId,
            CLAIMS.agentId,
            TOOL.paymentRematch,
            false,
        )
    })

    it("not attached and unticked: answers the ordinary refusal fact and logs why", async () => {
        const off = { kind: "refuse", ability: "qr.create", providers: ["sepay"] } as const
        const { door, abilities, logger } = await buildWithAbilities({ ...off, reason: "not_attached" })

        await expect(door.effectRight(QR)).resolves.toEqual({
            kind: "refused",
            id: "not_attached",
            facts: { tool: TOOL.paymentQrCreate, ability: "qr.create", providers: ["sepay"] },
        })
        abilities.judge.mockResolvedValue({ ...off, reason: "ability_off" })
        await expect(door.effectRight(QR)).resolves.toMatchObject({ kind: "refused", id: "ability_off" })
        expect(logger.warn).toHaveBeenCalled()
    })

    it("ticked ask: waits for a person with the fingerprint of the effect and its payload, and runs the call that replays it", async () => {
        const { door, abilities } = await buildWithAbilities({
            kind: "approval",
            provider: "sepay",
            ability: "qr.create",
            connectionId: "conn-mb",
        })
        const fingerprint = toolFingerprintOf(TOOL.paymentQrCreate, QR.payload)

        await expect(door.effectRight(QR)).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: {
                tool: TOOL.paymentQrCreate,
                fingerprint,
                reason: "ask_mode",
                args: JSON.stringify({ orderId: "o-1" }),
            },
        })

        abilities.judge.mockResolvedValue({
            kind: "allow",
            provider: "sepay",
            ability: "qr.create",
            connectionId: "conn-mb",
        })
        await expect(door.effectRight({ ...QR, approval: { by: "member-1", fingerprint } })).resolves.toBeNull()
        expect(abilities.judge).toHaveBeenLastCalledWith(CLAIMS.workspaceId, CLAIMS.agentId, TOOL.paymentQrCreate, true)
    })

    it("does not judge an effect that is no provider right, nor the customer send (its executor asks with the channel)", async () => {
        const { door, abilities, tokens } = await buildWithAbilities(null)

        await expect(door.effectRight({ ...QR, effect: TOOL.orderRecord })).resolves.toBeNull()
        await expect(door.effectRight({ ...QR, effect: TOOL.customerMessageSend })).resolves.toBeNull()
        expect(abilities.judge).not.toHaveBeenCalled()
        expect(tokens.verify).not.toHaveBeenCalled()
    })

    it("refuses an effect whose run token does not verify", async () => {
        const { door, tokens } = await buildWithAbilities(null)
        tokens.verify.mockReturnValue(null)

        await expect(door.effectRight(QR)).rejects.toMatchObject({ code: GraphNodesErrorCode.ToolTokenInvalid })
    })
})

const STEP = "run-1:match"
const BEGAN = "2026-11-10T10:00:00.000Z"
const GUARD_TURN: NodeTurn = {
    turnId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}
const TOLD = {
    channelRef: "line:run-1:match:aaaa",
    sentAt: "2026-11-10T09:30:00.000Z",
    text: "Em đã nhận, đang kiểm tra ạ.",
}

/** The door with the conversation lines and the customers' conversations bound; `rows` are the agent lines of the conversation read. */
const buildWithLines = async (rows: ReadonlyArray<Readonly<Record<string, unknown>>>) => {
    const lines = mock<NodeDataPort>({ kind: "message" })
    lines.read.mockResolvedValue([...rows])
    const registry = mock<GraphNodeRegistryService>()
    registry.optionalPortOf.mockImplementation((kind) => (kind === "message" ? lines : undefined))
    const conversations = mock<ChatConversationsService>()
    conversations.ofLeads.mockResolvedValue([
        mock<ChatHumanConversation>({ id: "c-web", channel: "website" }),
        mock<ChatHumanConversation>({ id: "c-zalo", channel: "zalo" }),
    ])
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeToolDoorService,
            { provide: McpGatewayService, useValue: mock<McpGatewayService>() },
            { provide: GraphNodeRunTokensService, useValue: mock<GraphNodeRunTokensService>() },
            { provide: LOGGER, useValue: logger },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: ChatConversationsService, useValue: conversations },
        ],
    }).compile()
    return { door: moduleRef.get(NodeToolDoorService), lines, conversations, logger }
}

const sendOf = (payload: Readonly<Record<string, unknown>>, turn: NodeTurn = GUARD_TURN) => ({
    effect: TOOL.customerMessageSend,
    payload,
    turn,
    step: STEP,
    startedAt: BEGAN,
})

describe("NodeToolDoorService repeat guard: one customer line per stop", () => {
    it("refuses a second line to the same conversation when the step already told it in an earlier attempt and nobody answered since", async () => {
        const { door, lines, logger } = await buildWithLines([TOLD])

        await expect(door.repeatGuard(sendOf({ conversationId: "c-1", text: "Em đang kiểm tra ạ." }))).resolves.toEqual(
            {
                kind: "refused",
                id: "already_told_for_this_stop",
                facts: { conversationId: "c-1", line: TOLD.text, at: TOLD.sentAt },
            },
        )
        expect(lines.read).toHaveBeenCalledWith(
            GUARD_TURN,
            { where: { conversationId: "c-1", role: "agent" }, fields: ["text", "sentAt", "channelRef"], limit: 20 },
            "workspace",
        )
        expect(logger.info).toHaveBeenCalled()
    })

    it("holds on every re-run of the stop: a park-resume, a manual retry with no words, a re-drive (the turn carries no newer answer)", async () => {
        const { door } = await buildWithLines([TOLD])
        const older = { ...GUARD_TURN, founderAnswers: [{ text: "ok", at: "2026-11-10T09:00:00.000Z" }] }

        for (const turn of [GUARD_TURN, older]) {
            await expect(door.repeatGuard(sendOf({ conversationId: "c-1", text: "x" }, turn))).resolves.toMatchObject({
                id: "already_told_for_this_stop",
            })
        }
    })

    it("lifts when the founder answered after the line: the step may tell the customer how it ended", async () => {
        const { door } = await buildWithLines([TOLD])
        const answered = { ...GUARD_TURN, founderAnswers: [{ text: "Cứ ghi nhận đủ", at: "2026-11-10T09:45:00.000Z" }] }

        await expect(
            door.repeatGuard(sendOf({ conversationId: "c-1", text: "Dạ em đã ghi nhận ạ." }, answered)),
        ).resolves.toBeNull()
    })

    it("never stops the lines of one attempt, nor a first line: a line sent since this attempt began does not count", async () => {
        const fresh = { ...TOLD, sentAt: "2026-11-10T10:00:03.000Z" }

        await expect(
            (await buildWithLines([fresh])).door.repeatGuard(sendOf({ conversationId: "c-1", text: "x" })),
        ).resolves.toBeNull()
        await expect(
            (await buildWithLines([])).door.repeatGuard(sendOf({ conversationId: "c-1", text: "x" })),
        ).resolves.toBeNull()
    })

    it("judges a message addressed by the customer on the conversation the send would pick (the bank-fed run with no conversation)", async () => {
        const { door, lines, conversations } = await buildWithLines([TOLD])

        await expect(door.repeatGuard(sendOf({ leadId: "lead-1", text: "x" }))).resolves.toMatchObject({
            id: "already_told_for_this_stop",
            facts: { conversationId: "c-web" },
        })
        await door.repeatGuard(sendOf({ leadId: "lead-1", channel: "zalo", text: "x" }))

        expect(conversations.ofLeads).toHaveBeenCalledWith("ws-1", ["lead-1"])
        expect(lines.read.mock.calls.map((call) => call[1].where?.conversationId)).toEqual(["c-web", "c-zalo"])
    })

    it("does not judge another effect, a send that addresses nobody, or a customer with no conversation", async () => {
        const { door, lines, conversations } = await buildWithLines([TOLD])

        await expect(
            door.repeatGuard({ ...sendOf({ conversationId: "c-1" }), effect: TOOL.teamMessagePost }),
        ).resolves.toBeNull()
        await expect(door.repeatGuard(sendOf({ text: "x" }))).resolves.toBeNull()
        conversations.ofLeads.mockResolvedValue([])
        await expect(door.repeatGuard(sendOf({ leadId: "lead-9", text: "x" }))).resolves.toBeNull()
        expect(lines.read).not.toHaveBeenCalled()
    })

    it("guards nothing in an app that serves no conversation lines", async () => {
        const { door } = await build()

        await expect(door.repeatGuard(sendOf({ conversationId: "c-1", text: "x" }))).resolves.toBeNull()
    })
})

describe("NodeToolDoorService hard lock of the context reads", () => {
    const LOCKED = { ...CLAIMS, leadId: "lead-1" } as NodeRunClaims

    it("refuses a read naming another conversation before the gateway (its executor) is called", async () => {
        const { door, gateway } = await build(LOCKED)

        await expect(
            door.call(callOf({ tool: TOOL.leadOrderList, args: { conversationId: "conv-OTHER" } })),
        ).rejects.toMatchObject({ code: GraphNodesErrorCode.ToolNotGranted, params: { reason: "other_conversation" } })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("refuses a read naming another customer before the gateway is called", async () => {
        const { door, gateway } = await build(LOCKED)

        await expect(
            door.call(callOf({ tool: TOOL.leadProfileGet, args: { leadId: "lead-OTHER" } })),
        ).rejects.toMatchObject({ code: GraphNodesErrorCode.ToolNotGranted, params: { reason: "other_lead" } })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("fills the run's own conversation and customer from the token, never from the call", async () => {
        const { door, gateway } = await build(LOCKED)

        await door.call(callOf({ tool: TOOL.leadOrderList, args: { limit: 3 } }))

        expect(gateway.call).toHaveBeenCalledWith(expect.anything(), TOOL.leadOrderList, {
            limit: 3,
            conversationId: "conv-1",
            leadId: "lead-1",
        })
    })

    it("leaves out a lock id the token does not carry, and passes any other tool's arguments as given", async () => {
        const { door, gateway } = await build({ ...CLAIMS, conversationId: null })

        await door.call(callOf({ tool: TOOL.conversationMessageList, args: {} }))
        await door.call(callOf())

        expect(gateway.call).toHaveBeenNthCalledWith(1, expect.anything(), TOOL.conversationMessageList, {})
        expect(gateway.call).toHaveBeenNthCalledWith(2, expect.anything(), "bank.transactions", ARGS)
    })
})
