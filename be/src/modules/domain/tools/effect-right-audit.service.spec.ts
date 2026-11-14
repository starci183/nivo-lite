import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { argsHashOf } from "./audit-mask.policy"
import { EFFECT_RIGHTS_CONNECTOR, EffectRightAuditService, type EffectRightLine } from "./effect-right-audit.service"
import { ToolsLogEvent } from "./tools.log-events"

const STEP = { nodeKey: "send-qr", versionId: "v-7", workflowId: "wf-consult" }

const lineOf = (over: Partial<EffectRightLine> = {}): EffectRightLine => ({
    workspaceId: "ws-1",
    agentId: "agent-sales",
    effect: TOOL.mailMessageSend,
    verdict: { kind: "allow", provider: "sepay", connectionId: "mb" },
    seen: { origin: "node", node: STEP },
    runId: "run-1",
    conversationId: "conv-1",
    ...over,
})

const build = async () => {
    const callLog = mock<ToolCallLogService>()
    callLog.append.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            EffectRightAuditService,
            { provide: ToolCallLogService, useValue: callLog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { audit: moduleRef.get(EffectRightAuditService), callLog, logger }
}

describe("EffectRightAuditService: one audit line per rights verdict of an effect", () => {
    it("files the effect, the agent, the run, the conversation and the workflow step under the connector `effect-rights`, with no argument", async () => {
        const { audit, callLog } = await build()

        await audit.record(lineOf())

        expect(callLog.append).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            connector: EFFECT_RIGHTS_CONNECTOR,
            tool: TOOL.mailMessageSend,
            agentId: "agent-sales",
            conversationId: "conv-1",
            workItemId: null,
            argsMaskedJson: "{}",
            argsHash: argsHashOf({}),
            outcome: "ok",
            errorCode: null,
            resultSummary: "",
            durationMs: 0,
            approvedBy: null,
            runId: "run-1",
            factReads: null,
            originKind: "node",
            nodeKey: "send-qr",
            workflowId: "wf-consult",
            workflowVersionId: "v-7",
        })
    })

    it("names an asked verdict `approval` and a refusal by its reason, and who approved a replayed call", async () => {
        const { audit, callLog } = await build()

        await audit.record(lineOf({ verdict: { kind: "approval", provider: "sepay", connectionId: "mb" } }))
        await audit.record(lineOf({ verdict: { kind: "refuse", reason: "not_attached", providers: ["sepay"] } }))
        await audit.record(lineOf({ approvedBy: "member-owner" }))

        expect(callLog.append.mock.calls.map(([line]) => [line.outcome, line.errorCode, line.approvedBy])).toEqual([
            ["approval", "ask_mode", null],
            ["refused", "not_attached", null],
            ["ok", null, "member-owner"],
        ])
    })

    it("files a verdict asked outside a node with no step and no road, as a caller that stated nothing", async () => {
        const { audit, callLog } = await build()

        await audit.record(lineOf({ seen: undefined, runId: undefined, conversationId: undefined }))

        expect(callLog.append.mock.calls[0]?.[0]).toMatchObject({
            originKind: null,
            nodeKey: null,
            workflowId: null,
            workflowVersionId: null,
            runId: null,
            conversationId: null,
        })
    })

    it("never rejects: a line that cannot be written is logged and the verdict stands", async () => {
        const { audit, callLog, logger } = await build()
        const cause = new TypeError("database unavailable")
        callLog.append.mockRejectedValue(cause)

        await expect(audit.record(lineOf())).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(ToolsLogEvent.EffectRightAuditFailed, cause, {
            workspaceId: "ws-1",
            agentId: "agent-sales",
            effect: TOOL.mailMessageSend,
        })
    })
})
