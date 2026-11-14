import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsService } from "@modules/domain/connections"
import {
    ContactsService,
    normaliseEmail,
    normalisePhone,
    type ContactActor,
    type IdentityInput,
} from "@modules/domain/contacts"
import { EntityEngineError, EntityEngineErrorCode } from "@modules/domain/entity-engine"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { WEBSITE_CHANNEL } from "@modules/domain/installed-plugins"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { eachInOrder } from "@modules/platform/primitives"
import { IsNull, type EntityManager } from "typeorm"
import { validWorkspaceTheme, type WorkspaceTheme } from "@modules/domain/workspace-settings"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import { InboxLeadsError, InboxLeadsErrorCode } from "./errors/inbox-leads.error"
import { WebsiteSiteEntity } from "./persistence/entities"
import { WebsiteLeadWakeService } from "./website-lead-wake.service"
import { WebsiteOwnerService } from "./website-owner.service"
import { customerKeyOf, isAnswerable, newSiteKey, presented, visitorIdOf, type Submission } from "./website-key.policy"

const MANAGERS = ["owner", "manager"] as const

/** The agent that receives a website's customers, or null for the workspace's installed front door of the website. */
type OptionalAgentId = string | null

/** The website intake as the owner sees it: the key, the switches, the agent and the address of the hosted form. */
export interface WebsiteSiteView {
    /** The public key of the hosted form. */
    readonly siteKey: string
    /** The intake is on. */
    readonly isEnabled: boolean
    /** The site shows the chat button. */
    readonly chatEnabled: boolean
    /** The site shows the hosted form; off refuses every submission. */
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
    /** Show or hide the hosted form. */
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
    /** The core contact the submission met. */
    readonly contactId: string
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

/** What the visitor gave to be known by: the name, and the phone and the email in the one form the contacts keep (else as typed). */
interface Given {
    readonly name: string | null
    readonly phone: string | null
    readonly email: string | null
    /** The phone in the contacts' form, or null when it has not the shape of one. */
    readonly phoneKey: string | null
    /** The email in the contacts' form, or null when it has not the shape of one. */
    readonly emailKey: string | null
}

/** Who adds the claims of a form to the contact: the website entrance itself, no person and no step. */
const BY_FORM: ContactActor = { kind: "channel" }

/** The name, phone and email of a submission, blanks taken out. */
const givenOf = (submission: WebsiteSubmission): Given => {
    const phone = presented(submission.phone)
    const email = presented(submission.email)
    const phoneKey = phone === null ? null : normalisePhone(phone)
    const emailKey = email === null ? null : normaliseEmail(email)
    return { name: presented(submission.name), phone: phoneKey ?? phone, email: emailKey ?? email, phoneKey, emailKey }
}

/** The phone and the email a visitor typed, as claims (no proof): a contact keeps them as proposals. */
const claimsOf = (given: Given): ReadonlyArray<IdentityInput> => [
    ...(given.phoneKey === null ? [] : [{ kind: "phone" as const, value: given.phoneKey }]),
    ...(given.emailKey === null ? [] : [{ kind: "email" as const, value: given.emailKey }]),
]

/** The site's own id of a visitor: the id the page keeps for them, else the submission (an anonymous visitor is met once per form). */
const visitorKeyOf = (visitor: string | null, submissionKey: string): string => {
    const id = presented(visitor)
    return id === null ? `submission:${submissionKey}` : `visitor:${id}`
}

@Injectable()
/**
 * The website that brings customers in. The owner switches it on, picks what the site shows and the agent that receives; a visitor fills in the
 * hosted form under the site key: the submission is stored as one input, the engine meets the visitor's core contact, and the owning agent
 * is woken with it. The intake writes no record of any agent.
 */
export class WebsiteSitesService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly connections: ConnectionsService,
        private readonly directory: AgentDirectoryService,
        private readonly contacts: ContactsService,
        private readonly inbound: InboundEventsService,
        private readonly wakes: WebsiteLeadWakeService,
        private readonly owners: WebsiteOwnerService,
        @InjectIds() private readonly ids: Ids,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    /** The website intake of the workspace; the first read issues its key. */
    async view(userId: string, workspaceId: string): Promise<WebsiteSiteView> {
        await this.members.require(userId, workspaceId)
        return this.viewOf(await this.siteOf(workspaceId))
    }

    /**
     * The key of the workspace's switched-on site when the site row names this agent as the one that receives its customers, else null:
     * the entrance that has no agent answering once the agent is removed (the agent row stays as a stopped husk, so a named site keeps
     * naming it). Reads only; the caller has proved the member and no site is created.
     */
    async frontDoorSiteOf(workspaceId: string, agentId: string): Promise<{ readonly siteKey: string } | null> {
        const site = await this.entityManager.findOne(WebsiteSiteEntity, { where: { workspaceId, agentId, isEnabled: true } })
        return site === null ? null : { siteKey: site.siteKey }
    }

    /**
     * The brand theme parameters of the workspace behind a switched-on site key, for the hosted page of its website (anonymous: the key names no
     * secret). It answers the parameters only, never the workspace: null while the workspace wears the NIVO default.
     */
    async themeOf(siteKey: string): Promise<WorkspaceTheme | null> {
        const site = await this.entityManager.findOne(WebsiteSiteEntity, { where: { siteKey } })
        if (site === null) throw new InboxLeadsError({ code: InboxLeadsErrorCode.SiteUnknown })
        if (!site.isEnabled) throw new InboxLeadsError({ code: InboxLeadsErrorCode.SiteOff })
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: { id: true, theme: true },
            where: { id: site.workspaceId, deletedAt: IsNull() },
        })
        return row?.theme == null ? null : validWorkspaceTheme(row.theme)
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

    /**
     * Writes the installed front door of the website onto the site row when the row names no agent or the agent it names is gone, so the owner
     * is explicit from then on; a site whose agent still exists keeps it. Owner or manager.
     */
    async adoptFrontDoor(userId: string, workspaceId: string, agentId: string): Promise<WebsiteSiteView> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const site = await this.siteOf(workspaceId)
        if (site.agentId !== null && (await this.directory.find(workspaceId, site.agentId)) !== null)
            return this.viewOf(site)
        site.agentId = agentId
        return this.viewOf(await this.entityManager.save(WebsiteSiteEntity, site))
    }

    /**
     * Accepts the form a visitor filled in under a site key: the owning agent is resolved first (none refuses before any write), the raw
     * submission is stored as one input (the same submission id twice is one input), the engine meets the core contact, and the owning
     * agent is woken with the contact. No record of any agent is written here: the agent's graph keeps its own.
     */
    async submit(siteKey: string, submission: WebsiteSubmission): Promise<WebsiteAccepted> {
        const site = await this.entityManager.findOne(WebsiteSiteEntity, { where: { siteKey } })
        if (site === null) throw new InboxLeadsError({ code: InboxLeadsErrorCode.SiteUnknown })
        if (!site.isEnabled || !site.formEnabled) throw new InboxLeadsError({ code: InboxLeadsErrorCode.SiteOff })
        if (!isAnswerable(submission)) throw new InboxLeadsError({ code: InboxLeadsErrorCode.SubmissionEmpty })
        const agentId = await this.owners.agentOf(site.workspaceId, site.agentId)
        if (agentId === null) throw new EntityEngineError({ code: EntityEngineErrorCode.AgentMissing })
        const given = givenOf(submission)
        const submissionKey = presented(submission.submissionId) ?? this.ids.next()
        const visitor = visitorIdOf(submission.visitor)
        const recorded = await this.inbound.recordInput({
            workspaceId: site.workspaceId,
            channel: WEBSITE_CHANNEL,
            kind: "message",
            senderName: given.name,
            senderContact: given.phone ?? given.email,
            body: presented(submission.message) ?? "",
            externalRef: null,
            eventId: `${site.siteKey}:${submissionKey}`,
            customerKey: customerKeyOf(
                { ...submission, phone: given.phone, email: given.email },
                visitor,
                submissionKey,
            ),
            source: sourceOf(submission),
        })
        const contactId = await this.meet(site, given, visitorKeyOf(visitor, submissionKey))
        await this.wakes.wake(site.workspaceId, agentId, {
            contactId,
            siteId: site.id,
            inboundEventId: recorded.inboundEventId,
            visitorKey: visitorKeyOf(visitor, submissionKey),
            name: given.name,
            phone: given.phone,
            email: given.email,
            request: presented(submission.message),
            source: sourceOf(submission),
        })
        return { contactId, inboundEventId: recorded.inboundEventId, duplicate: recorded.duplicate }
    }

    /**
     * The core contact of a website visitor: the contact that holds the site's own id of the visitor (the page's visitor id, else the
     * submission), else a new one; the phone and the email they typed are added as claims (unverified: they merge nothing and raise a
     * "maybe same person" suggestion when another contact holds the same).
     */
    private async meet(site: WebsiteSiteEntity, given: Given, visitorKey: string): Promise<string> {
        const contactId = await this.contacts.meetChannel(site.workspaceId, {
            channel: WEBSITE_CHANNEL,
            account: site.id,
            userId: visitorKey,
            name: given.name,
        })
        await eachInOrder(claimsOf(given), (claim) => this.contacts.linkIdentity(site.workspaceId, contactId, claim, BY_FORM))
        return contactId
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
            formUrl: `${origin}/form/${site.siteKey}`,
        }
    }
}
