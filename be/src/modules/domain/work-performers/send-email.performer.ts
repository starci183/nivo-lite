import { Injectable } from "@nestjs/common"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem, WorkPerformer } from "@modules/domain/decisions"
import { WorkspaceMailService } from "@modules/domain/email-messages"
import { WorkspacesService } from "@modules/domain/workspaces"
import { renderEmail } from "@modules/integrations/mail"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { textOf } from "./performer.policy"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

/** The shop name an email carries when the workspace has none. */
const DEFAULT_SHOP = "NIVO"

@Injectable()
/**
 * `send_email`: a customer-facing email (receipt, payment reminder). The proposal is preset by whoever asked (contact = recipient, subject,
 * purpose, refs = JSON, draft = the plain body). Only this performer may send customer mail: it hands the work item id to the mail
 * service as proof the gate approved it.
 */
export class SendEmailPerformer implements WorkPerformer {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly kit: PerformerKitService,
        private readonly mail: WorkspaceMailService,
        private readonly workspaces: WorkspacesService,
    ) {}

    /** The proposal is preset by whoever asked for the email. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Renders the shop layout and sends; an email that did not go out fails the item with the reason. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const to = textOf(proposal.fields.contact).trim()
        const subject = textOf(proposal.fields.subject)
        const shop = await this.workspaces.nameOf(ctx.workspaceId)
        const shopName = shop === "" ? DEFAULT_SHOP : shop
        const rendered = renderEmail({
            shopName,
            title: subject,
            body: proposal.draft ?? "",
            footer: this.kit.text(ctx, "emailFooter", { shop: shopName }),
            lang: ctx.locale,
        })
        const sent = await this.mail.send({
            workspaceId: ctx.workspaceId,
            to,
            subject,
            html: rendered.html,
            text: rendered.text,
            purpose: textOf(proposal.fields.purpose) === "" ? "customer_email" : textOf(proposal.fields.purpose),
            refs: this.refsOf(textOf(proposal.fields.refs), item.id),
            audience: "customer",
            workItemId: item.id,
        })
        if (sent.status !== "sent") {
            throw new WorkPerformersError({
                code: WorkPerformersErrorCode.EmailNotSent,
                params: { reason: sent.error ?? sent.status },
            })
        }
        return {
            summary: this.kit.text(ctx, "emailSent", { to, subject }),
            evidence: "captured",
            lead_id: item.lead_id,
            detail: proposal.draft ?? null,
        }
    }

    private refsOf(text: string, workItemId: string): Record<string, unknown> {
        if (text === "") return {}
        try {
            const parsed: unknown = JSON.parse(text)
            return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? { ...parsed } : {}
        } catch (cause) {
            this.logger.error(WorkPerformersLogEvent.RefsUnreadable, cause, { workItemId })
            return {}
        }
    }
}
