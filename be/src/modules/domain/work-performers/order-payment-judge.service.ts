import { Injectable } from "@nestjs/common"
import type { Brief, Judgement } from "@nivo-lite/agent-sdk/reconcile"
import { UsageMeterService } from "@modules/domain/knowledge"
import { InjectAi } from "@modules/integrations/ai"
import type { AiBudget, AiChatAnswer, AiService } from "@modules/integrations/ai"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { JUDGE_SYSTEM_PROMPT, JUDGEMENT_SCHEMA, judgeBriefOf, judgementOf } from "./order-payment.policy"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

/** How long the judge may take: it answers a small brief with reasoning off in a few seconds. */
const JUDGE_TIMEOUT_MS = 30_000

/** What one judgement may spend. */
const JUDGE_BUDGET: AiBudget = { effort: "off", maxTokens: 800 }

/** The module the call is metered under. */
const METER_MODULE = "accounting"

@Injectable()
/**
 * The judge of the order reconciliation: the model call of the agents (`AiService`, JSON mode with a bounded schema, usage metered under
 * the accounting module). It answers null when the model is unavailable or its answer does not fit the schema, so the case goes to a
 * person and money is never matched on a guess.
 */
export class OrderPaymentJudgeService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        private readonly usage: UsageMeterService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** One judgement of a brief; null when the model could not give a readable one. */
    async judge(workspaceId: string, brief: Brief): Promise<Judgement | null> {
        const user = judgeBriefOf(brief)
        const answer = await this.ai.chat({
            messages: [
                { role: "system", content: JUDGE_SYSTEM_PROMPT },
                { role: "user", content: user },
            ],
            json: true,
            schema: JUDGEMENT_SCHEMA,
            timeoutMs: JUDGE_TIMEOUT_MS,
            budget: JUDGE_BUDGET,
            context: null,
        })
        if (answer === null) return null
        await this.usage.record({
            workspaceId,
            kind: "engine",
            module: METER_MODULE,
            model: answer.model,
            usage: answer.usage,
            promptChars: JUDGE_SYSTEM_PROMPT.length + user.length,
            completionChars: answer.text.length,
        })
        const read = this.read(answer)
        if (read === null) this.logger.warn(WorkPerformersLogEvent.JudgementUnreadable, { workspaceId })
        return read
    }

    /** The answer as the schema reads it: the structured output first, else the JSON object found in the text. */
    private read(answer: AiChatAnswer): Judgement | null {
        const structured = JUDGEMENT_SCHEMA.safeParse(answer.parsed)
        if (structured.success) return judgementOf(structured.data)
        const from = answer.text.indexOf("{")
        const to = answer.text.lastIndexOf("}")
        if (from < 0 || to <= from) return null
        try {
            const loose = JUDGEMENT_SCHEMA.safeParse(JSON.parse(answer.text.slice(from, to + 1)))
            return loose.success ? judgementOf(loose.data) : null
        } catch {
            return null
        }
    }
}
