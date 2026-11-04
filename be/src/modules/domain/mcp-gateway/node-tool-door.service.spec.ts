import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphNodeRunTokensService, GraphNodesErrorCode, toolFingerprintOf } from "@modules/domain/graph-nodes"
import type { NodeRunClaims, NodeToolCall } from "@modules/domain/graph-nodes"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
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
    tool: "payment.instruction",
    args: ARGS,
    key: "step-1",
    approval: null,
    ...overrides,
})

const STEWARD = { seat_id: "member-owner", id: "user-1", name: "Lan", at: "2026-11-01T00:00:00.000Z" }

const build = async (claims: NodeRunClaims | null = CLAIMS, result: GatewayCallResult = { ok: true, value: {} }) => {
    const gateway = mock<McpGatewayService>()
    gateway.call.mockResolvedValue(result)
    const tokens = mock<GraphNodeRunTokensService>()
    tokens.verify.mockReturnValue(claims)
    const members = mock<WorkspaceMembersReadService>()
    members.firstStewards.mockResolvedValue([STEWARD])
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeToolDoorService,
            { provide: McpGatewayService, useValue: gateway },
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: WorkspaceMembersReadService, useValue: members },
        ],
    }).compile()
    return { door: moduleRef.get(NodeToolDoorService), gateway, tokens, members }
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
            },
            "payment.instruction",
            ARGS,
        )
    })

    it("refuses a call without a valid run token before anything is reached", async () => {
        const { door, gateway } = await build(null)

        await expect(door.call(callOf())).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolTokenInvalid,
            params: { tool: "payment.instruction" },
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("calls a customer's run as the customer audience", async () => {
        const { door, gateway } = await build({ ...CLAIMS, origin: "customer", scope: "public" })

        await door.call(callOf())

        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject({ audience: "customer" })
    })

    it("lets an owner or manager's turn call, and refuses any other member's turn unless a person approved it", async () => {
        const owner = await build({ ...CLAIMS, origin: "owner", memberId: "member-owner" })
        const staff = await build({ ...CLAIMS, origin: "staff", memberId: "member-staff" })
        const approval = { by: "member-owner", fingerprint: toolFingerprintOf("payment.instruction", ARGS) }

        await expect(owner.door.call(callOf())).resolves.toEqual({})
        await expect(staff.door.call(callOf())).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolFailed,
            params: { reason: "member_not_allowed" },
        })
        await expect(staff.door.call(callOf({ approval }))).resolves.toEqual({})
        expect(owner.members.firstStewards).toHaveBeenCalledWith("ws-1", 50)
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
            },
        })
    })

    it("runs a call that replays an approval of its fingerprint as approved by that person", async () => {
        const { door, gateway } = await build()
        const approval = { by: "member-owner", fingerprint: toolFingerprintOf("payment.instruction", ARGS) }

        await door.call(callOf({ approval }))

        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject({ approvedBy: "member-owner" })
    })

    it("asks again when the arguments changed after the approval", async () => {
        const { door, gateway } = await build()
        const approval = { by: "member-owner", fingerprint: toolFingerprintOf("payment.instruction", ARGS) }

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
        ["a grant it lacks", { ok: false, code: "not_granted", detail: "" }, GraphNodesErrorCode.ToolFailed],
    ] satisfies ReadonlyArray<readonly [string, GatewayCallResult, GraphNodesErrorCode]>)(
        "answers the typed error for %s",
        async (_name, result, code) => {
            const { door } = await build(CLAIMS, result)

            await expect(door.call(callOf())).rejects.toMatchObject({ code, params: { tool: "payment.instruction" } })
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
