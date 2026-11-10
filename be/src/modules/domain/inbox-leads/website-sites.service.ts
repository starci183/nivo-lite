import { Injectable } from "@nestjs/common"
import { contactParts } from "@nivo-lite/blocks-core/rules/sales"
import type { EngineResult, EntitiesApi, WriteValues } from "@nivo-lite/agent-sdk/entity/port"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsService } from "@modules/domain/connections"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import type { EntityManager } from "typeorm"
import { InboxLeadsError, InboxLeadsErrorCode } from "./errors/inbox-leads.error"
import type { OptionalAgentId } from "./inbox-leads.contracts"
import { WebsiteSiteEntity } from "./persistence/entities"
import { WebsiteLeadWakeService } from "./website-lead-wake.service"
import { customerKeyOf, isAnswerable, newSiteKey, presented } from "./website-key.policy"
import type { Submission } from "./website-key.policy"

const MANAGERS = ["owner", "manager"] as const

/** The website intake as the owner sees it: the key, the switches, the agent and the address of the hosted form. */
export interface WebsiteSiteView {
    /** The public key of the hosted form. */
    readonly siteKey: string
    /** The intake is on. */
    readonly isEnabled: boolean
    /** The site shows the chat button. */
    readonly chatEnabled: boolean
    /** The site shows the order form. */
    readonly formEnabled: boolean
    /** The site shows the price list. */
    readonly pricesEnabled: boolean
    /** The agent that receives the customers, or null. */
    readonly agentId: OptionalAgentId
    /** The address of the hosted form a visitor fills in (a link, or the source of an iframe). */
    readonly formUrl: string
}

/** What the owner changes; a missing field keeps its value. */
export interface WebsiteSiteChange {
    /** Switch the intake on or off. */
    readonly isEnabled?: boolean | undefined
    /** Show or hide the chat button. */
    readonly chatEnabled?: boolean | undefined
    /** Show or hide the order form. */
    readonly formEnabled?: boolean | undefined
    /** Show or hide the price list. */
    readonly pricesEnabled?: boolean | undefined
    /** The agent that receives the customers; null clears it, undefined keeps it. */
    readonly agentId?: OptionalAgentId | undefined
}

/** What a visitor sent through the hosted form; blank fields count as missing. */
export interface WebsiteSubmission extends Submission {
    /** The page the form sat on. */
    readonly pagePath: string | null
    /** The campaign the visit came from. */
    readonly campaign: string | null
    /** The device kind the browser reported. */
    readonly device: string | null
    /** The id the page gave this visitor, so one person's inputs group even without a phone. */
    readonly visitor: string | null
    /** The id of this submission; a form sent twice with it is one input. */
    readonly submissionId: string | null
}

/** What an accepted submission became. */
export interface WebsiteAccepted {
    /** The customer the submission is. */
    readonly leadId: string
    /** The input that recorded it. */
    readonly inboundEventId: string
    /** The same submission had been accepted before. */
    readonly duplicate: boolean
}

/** The page, the campaign and the device of a submission, the ones that say something. */
const sourceOf = (submission: WebsiteSubmission): Readonly<Record<string, string>> =>
    Object.fromEntries(
        Object.entries({ page: submission.pagePath, campaign: submission.campaign, device: submission.device })
            .map(([key, value]) => [key, presented(value)] as const)
            .filter((entry): entry is readonly [string, string] => entry[1] !== null),
    )

@Injectable()
/**
 * The website that brings customers in. The owner switches it on, picks what the site shows and the agent that receives; a visitor fills in the
 * hosted form under the site key and becomes one input and one customer (found by phone or email, else made), so the inbox lists it.
 */
export class WebsiteSitesService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly connections: ConnectionsService,
        private readonly directory: AgentDirectoryService,
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        private readonly inbound: InboundEventsService,
        private readonly wakes: WebsiteLeadWakeService,
        @InjectIds() private readonly ids: Ids,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    /** The website intake of the workspace; the first read issues its key. */
    async view(userId: string, workspaceId: string): Promise<WebsiteSiteView> {
        await this.members.require(userId, workspaceId)
        return this.viewOf(await this.siteOf(workspaceId))
    }

    /** Changes the switches and the agent; owner or manager. */
    async save(userId: string, workspaceId: string, change: WebsiteSiteChange): Promise<WebsiteSiteView> {
        await this.members.require(userId, workspaceId, MANAGERS)
        if (change.agentId !== undefined && change.agentId !== null) {
            if ((await this.directory.find(workspaceId, change.agentId)) === null) {
                throw new InboxLeadsError({ code: InboxLeadsErrorCode.AgentUnknown })
            }
        }
        const site = await this.siteOf(workspaceId)
        if (change.isEnabled !== undefined) site.isEnabled = change.isEnabled
        if (change.chatEnabled !== undefined) site.chatEnabled = change.chatEnabled
        if (change.formEnabled !== undefined) site.formEnabled = change.formEnabled
        if (change.pricesEnabled !== undefined) site.pricesEnabled = change.pricesEnabled
        if (change.agentId !== undefined) site.agentId = change.agentId
        return this.viewOf(await this.entityManager.save(WebsiteSiteEntity, site))
    }

    /** Accepts the form a visitor filled in under a site key: one input, one customer. */
    async submit(siteKey: string, submission: WebsiteSubmission): Promise<WebsiteAccepted> {
        const site = await this.entityManager.findOne(WebsiteSiteEntity, { where: { siteKey } })
        if (site === null) throw new InboxLeadsError({ code: InboxLeadsErrorCode.SiteUnknown })
        if (!site.isEnabled || !site.formEnabled) throw new InboxLeadsError({ code: InboxLeadsErrorCode.SiteOff })
        if (!isAnswerable(submission)) throw new InboxLeadsError({ code: InboxLeadsErrorCode.SubmissionEmpty })
        const phone = contactParts(presented(submission.phone)).phone
        const email = contactParts(presented(submission.email)).email
        const fresh = this.ids.next()
        const agentId = await this.wakes.targetOf(site.workspaceId, site.agentId)
        const leadId = await this.ensureLead(site, agentId, submission, phone, email)
        const recorded = await this.inbound.recordInput({
            workspaceId: site.workspaceId,
            channel: "website",
            kind: "lead",
            senderName: presented(submission.name),
            senderContact: phone ?? email,
            body: presented(submission.message) ?? "",
            externalRef: null,
            eventId: `${site.siteKey}:${presented(submission.submissionId) ?? fresh}`,
            customerKey: customerKeyOf({ ...submission, phone, email }, submission.visitor, fresh),
            source: sourceOf(submission),
        })
        await this.inbound.mark(site.workspaceId, recorded.inboundEventId, null, leadId)
        await this.wakes.wake(site.workspaceId, agentId, {
            leadId,
            inboundEventId: recorded.inboundEventId,
            name: presented(submission.name),
            phone,
            email,
            request: presented(submission.message),
            source: sourceOf(submission),
        })
        return { leadId, inboundEventId: recorded.inboundEventId, duplicate: recorded.duplicate }
    }

    private async siteOf(workspaceId: string): Promise<WebsiteSiteEntity> {
        const found = await this.entityManager.findOne(WebsiteSiteEntity, { where: { workspaceId } })
        if (found !== null) return found
        return this.entityManager.save(
            WebsiteSiteEntity,
            this.entityManager.create(WebsiteSiteEntity, { workspaceId, siteKey: newSiteKey(), agentId: null }),
        )
    }

    private viewOf(site: WebsiteSiteEntity): WebsiteSiteView {
        const origin = this.connections.publicOrigin() ?? this.connections.siteBase()
        return {
            siteKey: site.siteKey,
            isEnabled: site.isEnabled,
            chatEnabled: site.chatEnabled,
            formEnabled: site.formEnabled,
            pricesEnabled: site.pricesEnabled,
            agentId: site.agentId,
            formUrl: `${origin}/w/${site.siteKey}`,
        }
    }

    /** Finds the lead by its phone, else by its email, else makes it; the engine answers whether the write was accepted. */
    private makeLead(
        api: EntitiesApi,
        values: WriteValues,
        phone: string | null,
        email: string | null,
    ): Promise<EngineResult> {
        if (phone !== null) return api.ensure("sales.lead", "phone", values)
        if (email !== null) return api.ensure("sales.lead", "email", values)
        return api.insert("sales.lead", values)
    }

    /** The customer the submission is: found by phone (else email), else made; the engine's declaration judges the values. */
    private ensureLead(
        site: WebsiteSiteEntity,
        agentId: string | null,
        submission: WebsiteSubmission,
        phone: string | null,
        email: string | null,
    ): Promise<string> {
        return this.engine.scoped(site.workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const message = presented(submission.message)
            const values = {
                contactName: presented(submission.name) ?? phone ?? email ?? "website",
                channel: "website",
                ...(agentId === null ? {} : { owner: agentId }),
                ...(message === null ? {} : { need: message }),
                ...(phone === null ? {} : { phone }),
                ...(phone === null && email !== null ? { email } : {}),
            }
            const made = await this.makeLead(api, values, phone, email)
            if (!made.ok) throw new InboxLeadsError({ code: InboxLeadsErrorCode.WriteRefused })
            return made.row.id
        })
    }
}
