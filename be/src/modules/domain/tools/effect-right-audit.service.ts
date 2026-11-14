import { Injectable } from "@nestjs/common"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { argsHashOf } from "./audit-mask.policy"
import { ToolsLogEvent } from "./tools.log-events"
import type { RightVerdict } from "./provider-abilities.policy"
import type { OptionalRightSeen } from "./right-origin.contracts"

/**
 * The connector an effect's rights verdict is filed under in the audit: no connector ran (an effect is acted by its executor, not by
 * the gateway), so the line names what it is. `connector = 'effect-rights'` tells such a line from a tool call's.
 */
export const EFFECT_RIGHTS_CONNECTOR = "effect-rights"

/** The arguments an effect's verdict line keeps: none. The payload of an effect (a customer's words, an order) never enters this line. */
const NO_ARGUMENTS = {}

/** One rights verdict of an effect to file: who asked for which effect, in which run and conversation, from where, and the verdict. */
export interface EffectRightLine {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent of the run. */
    readonly agentId: string
    /** The effect (its id is its tool id: `nivo.tool.customer.message.send`, `nivo.tool.payment.transfer.create`). */
    readonly effect: string
    /** The verdict the rights gave. */
    readonly verdict: RightVerdict
    /** Where the effect was asked from: the road and the workflow step; absent for a caller that stated none. */
    readonly seen: OptionalRightSeen
    /** The run, when the caller knows it. */
    readonly runId?: string | null | undefined
    /** The customer conversation the effect serves, when the caller knows it. */
    readonly conversationId?: string | null | undefined
    /** The person whose approval of this exact call the verdict was given under, or null. */
    readonly approvedBy?: string | null | undefined
}

/** The outcome and the error code of an audit line. */
interface AuditOutcome {
    /** What became of the call: let through, asked a person, or refused. */
    readonly outcome: string
    /** The reason of an ask or a refusal; null for a call let through. */
    readonly errorCode: string | null
}

/** The outcome and the code of a verdict as an audit line holds them: let through, asked a person, or refused with its reason. */
const outcomeOf = (verdict: RightVerdict): AuditOutcome => {
    if (verdict.kind === "allow") return { outcome: "ok", errorCode: null }
    if (verdict.kind === "approval") return { outcome: "approval", errorCode: "ask_mode" }
    return { outcome: "refused", errorCode: verdict.reason }
}

@Injectable()
/**
 * The audit line of an EFFECT's rights verdict. A tool call is audited by the gateway; an effect that acts on a connected account (the
 * customer send, the payment QR) is judged by the rights and acted by its executor, and left no line, so the audit could not say
 * which node used which right. This files one line per verdict in the same log (`mcp_call_log`), under the connector
 * `effect-rights`: the effect, the agent, the run, the conversation, the road and the workflow step (node, workflow, pinned version),
 * and the verdict as outcome (`ok` = the right let it through, never "the effect succeeded") and code. No argument and no text of
 * the effect is kept. It never changes or delays a decision beyond its one insert: a line that cannot be written is logged and the
 * verdict stands.
 */
export class EffectRightAuditService {
    constructor(
        private readonly callLog: ToolCallLogService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Files the verdict; never rejects. */
    async record(line: EffectRightLine): Promise<void> {
        const node = line.seen?.node
        try {
            await this.callLog.append({
                workspaceId: line.workspaceId,
                connector: EFFECT_RIGHTS_CONNECTOR,
                tool: line.effect,
                agentId: line.agentId,
                conversationId: line.conversationId ?? null,
                workItemId: null,
                argsMaskedJson: JSON.stringify(NO_ARGUMENTS),
                argsHash: argsHashOf(NO_ARGUMENTS),
                ...outcomeOf(line.verdict),
                resultSummary: "",
                durationMs: 0,
                approvedBy: line.approvedBy ?? null,
                runId: line.runId ?? null,
                factReads: null,
                originKind: line.seen?.origin ?? null,
                nodeKey: node?.nodeKey ?? null,
                workflowId: node?.workflowId ?? null,
                workflowVersionId: node?.versionId ?? null,
            })
        } catch (cause: unknown) {
            // The verdict was already given and is acted on: a lost audit line is said in the log, never turned into a refusal.
            this.logger.error(ToolsLogEvent.EffectRightAuditFailed, cause, {
                workspaceId: line.workspaceId,
                agentId: line.agentId,
                effect: line.effect,
            })
        }
    }
}
