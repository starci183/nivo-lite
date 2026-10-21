import { Injectable } from "@nestjs/common"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import type { AutomationGate, GateOutcome, GateSubmission } from "@modules/domain/automations"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AUTOMATION_LOCALE } from "./automation-ports.policy"

/** The only reason to wait that "send by itself" may approve: the owner's rule for the action asks. */
const RULE_REASON = "over_authority"

/** The state an automation reads from where the work item stands. */
const stateOf = (item: WorkItem): GateOutcome["state"] => {
    if (item.status === "done") return "sent"
    if (item.status === "waiting_decision") return "waiting"
    return item.status === "rejected" ? "rejected" : "failed"
}

@Injectable()
/**
 * The authority gate for automation messages: each one is a preset work item (the text is already written, no model call), so the
 * owner's rule for the action decides. A message that waits is not sent; when the owner accepted "send by itself" and the only
 * reason to wait is the rule, it is approved on their behalf.
 */
export class AutomationGateService implements AutomationGate {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly engine: WorkEngineService,
    ) {}

    /** Puts the message through the owner's rule for its action and answers where it stands. */
    async submit(submission: GateSubmission): Promise<GateOutcome> {
        const ctx: WorkContext = {
            workspaceId: submission.workspaceId,
            actor: submission.actor,
            locale: AUTOMATION_LOCALE,
        }
        const asked = await this.engine.runWork(ctx, {
            action: submission.action,
            subject_type: submission.subject.type,
            subject_id: submission.subject.id,
            lead_id: submission.leadId,
            dedupeKey: submission.dedupeKey,
            preset: true,
            noChain: true,
            ...(submission.forceAsk ? { forceAsk: RULE_REASON } : {}),
            seed: { summary: submission.summary, draft: submission.draft, fields: submission.fields },
        })
        const autoApproved =
            asked.status === "waiting_decision" &&
            submission.autoApprove &&
            !submission.forceAsk &&
            asked.reasons.every((reason) => reason === RULE_REASON)
        const item = autoApproved
            ? await this.engine.resumeWork(
                  ctx,
                  asked.id,
                  "approved",
                  {},
                  { name: this.say("autoSendBy"), kind: "owner" },
                  this.say("autoSendNote"),
              )
            : asked
        return {
            itemId: item.id,
            state: stateOf(item),
            summary: item.result?.summary ?? null,
            reason: item.reason,
            error: item.error,
            autoApproved,
        }
    }

    private say(key: string): string {
        return this.catalog.get(`automationPorts.${key}`, {}, AUTOMATION_LOCALE)
    }
}
