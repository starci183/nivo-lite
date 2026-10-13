import { Injectable } from "@nestjs/common"
import { AuthorityService } from "@modules/domain/authority"
import { ModuleCatalogService, formatVnd } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import type { LeadRecordRow } from "@modules/domain/leads"
import { authorityBrief } from "@modules/integrations/deepseek"
import type { DeepseekScope, LeadInput } from "@modules/integrations/deepseek"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"

@Injectable()
/** What every performer reaches for: its texts, the owner's authority brief for prompts, the prompt scope, and the labels of departments and money. */
export class PerformerKitService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly authority: AuthorityService,
        private readonly modules: ModuleCatalogService,
    ) {}

    /** A performer text in the language of the call. */
    text(ctx: WorkContext, key: string, params: Readonly<Record<string, string | number>> = {}): string {
        return this.catalog.get(`performers.${key}`, params, ctx.locale)
    }

    /** An amount in dong, or "no amount yet" when there is none. */
    money(ctx: WorkContext, amount: number | null | undefined): string {
        return amount === null || amount === undefined ? this.text(ctx, "orderNoAmount") : formatVnd(amount, ctx.locale)
    }

    /** The owner's granted authority as a prompt section; empty when nothing is set. */
    async brief(ctx: WorkContext): Promise<string> {
        return authorityBrief(await this.authority.load({ workspaceId: ctx.workspaceId }))
    }

    /** Who and what language a prompt writes for. */
    scope(ctx: WorkContext): DeepseekScope {
        return { workspaceId: ctx.workspaceId, locale: ctx.locale }
    }

    /** The lead as a prompt reads it. */
    leadInput(lead: LeadRecordRow): LeadInput {
        return { contact_name: lead.contact_name, company: lead.company, channel: lead.channel, need: lead.need }
    }

    /** The name of a department in the language of the call. */
    department(ctx: WorkContext, department: string): Promise<string> {
        return this.modules.nameOf(department, ctx.locale)
    }

    /** The label of a lead stage. */
    stage(ctx: WorkContext, stage: string): string {
        return this.text(ctx, `stage.${stage}`)
    }
}
