import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { MessagesService } from "@modules/domain/messages"
import { ResponsibilitiesService } from "@modules/domain/responsibilities"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, InjectRequestLocale } from "@modules/platform/i18n"
import type { MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import { LeadsError, LeadsErrorCode } from "./errors/leads.error"
import type { RecordOutcomeParams, RecordedOutcome } from "./leads.contracts"
import type { LeadsRow } from "./persistence/leads.rows"
import { UPDATE_LEAD_STAGE } from "./persistence/leads.sql"

/** The evidence-log kind of a recorded outcome. */
const OUTCOME_KIND = "outcome.recorded"

type StagedLead = Pick<LeadsRow, "id" | "contact_name" | "company" | "channel" | "need" | "origin" | "stage">

@Injectable()
/** The journey of a lead reached only through the shared primary EntityManager. */
export class LeadsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        @InjectRequestLocale() private readonly requestLocale: RequestLocale,
        private readonly members: WorkspaceMembersService,
        private readonly events: EventsService,
        private readonly teamChat: MessagesService,
        private readonly responsibilities: ResponsibilitiesService,
    ) {}

    /**
     * Records the outcome of the journey of a lead: the stage, the evidence line and the team-chat line are written in one
     * transaction. A won deal is handed to the workspace Accounting agent as the next responsibility, when there is one.
     */
    async recordOutcome(params: RecordOutcomeParams): Promise<RecordedOutcome> {
        const member = await this.members.require(params.userId, params.workspaceId)
        const locale = this.requestLocale.of(params.acceptLanguage)
        return this.entityManager.transaction(async (tx) => {
            const [lead] = await tx.query<Array<StagedLead>>(UPDATE_LEAD_STAGE, [
                params.workspaceId,
                params.leadId,
                params.stage,
            ])
            if (lead === undefined) {
                throw new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: params.leadId } })
            }
            const stage = this.messages.get(`leads.stage.${params.stage}`, {}, locale)
            await this.events.record(
                {
                    workspaceId: params.workspaceId,
                    leadId: params.leadId,
                    kind: OUTCOME_KIND,
                    actor: member.displayName,
                    summary: this.messages.get("leads.stage-event", { stage }, locale),
                    evidence: params.evidence === "" ? null : params.evidence,
                },
                tx,
            )
            await this.teamChat.postSystem({
                workspaceId: params.workspaceId,
                leadId: params.leadId,
                body: this.messages.get("leads.stage-message", { name: lead.contact_name, stage }, locale),
                manager: tx,
            })
            const handedToAccounting =
                params.stage === "won" &&
                (await this.responsibilities.handToAccounting({
                    workspaceId: params.workspaceId,
                    leadId: params.leadId,
                    contactName: lead.contact_name,
                    locale,
                    manager: tx,
                }))
            return {
                leadId: lead.id,
                stage: lead.stage,
                contactName: lead.contact_name,
                company: lead.company,
                channel: lead.channel,
                need: lead.need,
                origin: lead.origin,
                handedToAccounting,
            }
        })
    }
}
