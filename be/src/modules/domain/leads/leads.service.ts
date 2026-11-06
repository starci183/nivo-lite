import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { TeamChatService } from "@modules/domain/team-chat"
import { ResponsibilitiesService } from "@modules/domain/responsibilities"
import { InjectPrimaryEntityManager, returnedRows, rowShape } from "@modules/platform/database"
import { InjectMessageCatalog, InjectRequestLocale } from "@modules/platform/i18n"
import type { MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import { LeadsError, LeadsErrorCode } from "./errors/leads.error"
import type { RecordOutcomeParams, RecordedOutcome } from "./leads.contracts"
import { LeadEntity } from "./persistence/entities"

/** The evidence-log kind of a recorded outcome. */
const OUTCOME_KIND = "outcome.recorded"

/** The lead a stage change answers, as the database returns it. */
const isStagedLead = rowShape({
    id: "string",
    contact_name: "string",
    company: "string",
    channel: "string",
    need: "string",
    stage: "string",
})

/** The columns a stage change answers about the lead it moved. */
const STAGED_LEAD_RETURNING = "id, contact_name, company, channel, need, stage"

@Injectable()
/** The journey of a lead reached only through the shared primary EntityManager. */
export class LeadsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        @InjectRequestLocale() private readonly requestLocale: RequestLocale,
        private readonly members: WorkspaceMembersService,
        private readonly events: EventsService,
        private readonly teamChat: TeamChatService,
        private readonly responsibilities: ResponsibilitiesService,
    ) {}

    /**
     * Records the outcome of the journey of a lead: the stage and the evidence line are written in one transaction, and the
     * sales agent tells the owner once it committed. A won deal is handed to the workspace Accounting agent as the next responsibility, when there is one.
     */
    async recordOutcome(params: RecordOutcomeParams): Promise<RecordedOutcome> {
        const member = await this.members.require(params.userId, params.workspaceId)
        const locale = this.requestLocale.of(params.acceptLanguage)
        const outcome = await this.entityManager.transaction(async (tx) => {
            const moved = await tx
                .createQueryBuilder(LeadEntity, "l")
                .update()
                .set({ stage: params.stage })
                .where("workspace_id = :workspaceId AND id = :leadId", {
                    workspaceId: params.workspaceId,
                    leadId: params.leadId,
                })
                .returning(STAGED_LEAD_RETURNING)
                .execute()
            const [lead] = returnedRows(moved.raw, isStagedLead)
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
                handedToAccounting,
            }
        })
        await this.teamChat.postAsAgent(params.workspaceId, {
            agent: "sales",
            toUserId: null,
            body: this.messages.get(
                "leads.stage-message",
                { name: outcome.contactName, stage: this.messages.get(`leads.stage.${params.stage}`, {}, locale) },
                locale,
            ),
            key: null,
        })
        return outcome
    }
}
