import { Test } from "@nestjs/testing"
import { fakeIds, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentCard } from "@modules/domain/agents"
import { ConnectionsService } from "@modules/domain/connections"
import { ContactsService } from "@modules/domain/contacts"
import type { ContactIdentity } from "@modules/domain/contacts"
import { EntityEngineErrorCode } from "@modules/domain/entity-engine"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import {
    WEBSITE_AGENT as AGENT,
    WEBSITE_KEY as KEY,
    WEBSITE_WORKSPACE as WORKSPACE,
    websiteSite as siteOf,
} from "@tests/fixtures/builders/website-site.builder"
import { websiteIntakeEntities } from "./persistence/entities"
import { WebsiteLeadWakeService } from "./website-lead-wake.service"
import { WebsiteOwnerService } from "./website-owner.service"
import { WebsiteSitesService } from "./website-sites.service"
import type { WebsiteSubmission } from "./website-sites.service"

const [WebsiteSiteEntity] = websiteIntakeEntities
const CONTACT = "33333333-3333-4333-8333-333333333333"
const SITE = "site-1"
const VISITOR = "7c9e6679-7425-40de-944b-e07fc1f90ae7"

const FORM: WebsiteSubmission = {
    name: " Cam ",
    phone: "0900 000 101",
    email: null,
    message: "roses",
    pagePath: "/dat-hoa",
    campaign: " ",
    device: "mobile",
    visitor: null,
    submissionId: "sub-1",
}

/** The service is built with no entity engine at all: the intake cannot write a record of any agent. */
const build = async (em = mockEntityManager()) => {
    const members = mock<WorkspaceMembersService>()
    const connections = mock<ConnectionsService>()
    const directory = mock<AgentDirectoryService>()
    const contacts = mock<ContactsService>()
    const inbound = mock<InboundEventsService>()
    const wakes = mock<WebsiteLeadWakeService>()
    const owners = mock<WebsiteOwnerService>()
    members.require.mockResolvedValue(mock<WorkspaceMember>())
    connections.publicOrigin.mockReturnValue("https://nivo.example")
    contacts.meetChannel.mockResolvedValue(CONTACT)
    contacts.linkIdentity.mockResolvedValue({ kind: "proposed", identity: mock<ContactIdentity>() })
    inbound.recordInput.mockResolvedValue({ duplicate: false, inboundEventId: "ev-1" })
    owners.agentOf.mockImplementation((_workspace, siteAgent) => Promise.resolve(siteAgent))
    wakes.wake.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebsiteSitesService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ConnectionsService, useValue: connections },
            { provide: AgentDirectoryService, useValue: directory },
            { provide: ContactsService, useValue: contacts },
            { provide: InboundEventsService, useValue: inbound },
            { provide: WebsiteLeadWakeService, useValue: wakes },
            { provide: WebsiteOwnerService, useValue: owners },
            { provide: IDS, useValue: fakeIds() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
        ],
    }).compile()
    return {
        sites: moduleRef.get(WebsiteSitesService),
        members,
        connections,
        directory,
        contacts,
        inbound,
        wakes,
        owners,
        em,
    }
}

describe("WebsiteSitesService view", () => {
    it("shows the intake with the address of the hosted form", async () => {
        const { sites } = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }))

        await expect(sites.view("user-1", WORKSPACE)).resolves.toMatchObject({
            siteKey: KEY,
            agentId: AGENT,
            formUrl: `https://nivo.example/form/${KEY}`,
        })
    })

    it("issues the key on the first read and falls back to the site origin when no public one is set", async () => {
        const em = mockEntityManager({
            findOne: [WebsiteSiteEntity, null],
            save: [WebsiteSiteEntity, siteOf({ agentId: null })],
        })
        const { sites, connections } = await build(em)
        connections.publicOrigin.mockReturnValue(null)
        connections.siteBase.mockReturnValue("https://site.example")

        const view = await sites.view("user-1", WORKSPACE)

        expect(em.save.mock.calls[0]?.[1]).toMatchObject({ workspaceId: WORKSPACE, agentId: null })
        expect(view).toMatchObject({ agentId: null, formUrl: `https://site.example/form/${KEY}` })
    })
})

describe("WebsiteSitesService save", () => {
    it("saves what the owner changed, as an owner or a manager", async () => {
        const site = siteOf({})
        const em = mockEntityManager({ findOne: [WebsiteSiteEntity, site], save: [WebsiteSiteEntity, site] })
        const { sites, members, directory } = await build(em)
        directory.find.mockResolvedValueOnce(mock<AgentCard>())

        const view = await sites.save("user-1", WORKSPACE, {
            isEnabled: false,
            chatEnabled: false,
            formEnabled: false,
            pricesEnabled: true,
            agentId: AGENT,
        })

        expect(members.require).toHaveBeenCalledWith("user-1", WORKSPACE, ["owner", "manager"])
        expect(view).toMatchObject({ isEnabled: false, chatEnabled: false, formEnabled: false, pricesEnabled: true })
    })

    it("leaves alone what the change leaves out, and clears the agent on null", async () => {
        const site = siteOf({ isEnabled: false })
        const em = mockEntityManager({ findOne: [WebsiteSiteEntity, site], save: [WebsiteSiteEntity, site] })
        const { sites, directory } = await build(em)

        const view = await sites.save("user-1", WORKSPACE, { agentId: null })

        expect(directory.find).not.toHaveBeenCalled()
        expect(view).toMatchObject({ isEnabled: false, chatEnabled: true, agentId: null })
    })

    it("changes one switch and nothing else", async () => {
        const site = siteOf({ isEnabled: false })
        const em = mockEntityManager({ findOne: [WebsiteSiteEntity, site], save: [WebsiteSiteEntity, site] })
        const { sites } = await build(em)

        await expect(sites.save("user-1", WORKSPACE, { isEnabled: true })).resolves.toMatchObject({
            isEnabled: true,
            agentId: AGENT,
        })
    })

    it("refuses an agent the workspace does not know", async () => {
        const { sites, directory } = await build()
        directory.find.mockResolvedValueOnce(null)

        await expect(sites.save("user-1", WORKSPACE, { agentId: AGENT })).rejects.toMatchObject({
            code: "INBOX_LEADS_AGENT_UNKNOWN",
        })
    })
})

describe("WebsiteSitesService adoptFrontDoor", () => {
    it("writes the installed front door onto a site that names no agent", async () => {
        const site = siteOf({ agentId: null })
        const em = mockEntityManager({ findOne: [WebsiteSiteEntity, site], save: [WebsiteSiteEntity, site] })
        const { sites, members } = await build(em)

        const view = await sites.adoptFrontDoor("user-1", WORKSPACE, "sales-1")

        expect(members.require).toHaveBeenCalledWith("user-1", WORKSPACE, ["owner", "manager"])
        expect(em.save.mock.calls[0]?.[1]).toMatchObject({ agentId: "sales-1" })
        expect(view.agentId).toBe("sales-1")
    })

    it("replaces an agent that was deleted, and keeps one that still exists", async () => {
        const gone = siteOf({})
        const goneEm = mockEntityManager({ findOne: [WebsiteSiteEntity, gone], save: [WebsiteSiteEntity, gone] })
        const first = await build(goneEm)
        first.directory.find.mockResolvedValueOnce(null)
        await expect(first.sites.adoptFrontDoor("user-1", WORKSPACE, "sales-1")).resolves.toMatchObject({
            agentId: "sales-1",
        })

        const kept = siteOf({})
        const keptEm = mockEntityManager({ findOne: [WebsiteSiteEntity, kept], save: [WebsiteSiteEntity, kept] })
        const second = await build(keptEm)
        second.directory.find.mockResolvedValueOnce(mock<AgentCard>())
        await expect(second.sites.adoptFrontDoor("user-1", WORKSPACE, "sales-1")).resolves.toMatchObject({
            agentId: AGENT,
        })
        expect(keptEm.save).not.toHaveBeenCalled()
    })
})

describe("WebsiteSitesService submit", () => {
    it("stores the raw submission as one input and meets the core contact by the site's id of the visitor, with the typed phone as a claim", async () => {
        const { sites, contacts, inbound } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }),
        )

        await expect(sites.submit(KEY, FORM)).resolves.toEqual({
            contactId: CONTACT,
            inboundEventId: "ev-1",
            duplicate: false,
        })

        expect(inbound.recordInput).toHaveBeenCalledWith({
            workspaceId: WORKSPACE,
            channel: "website",
            kind: "message",
            senderName: "Cam",
            senderContact: "84900000101",
            body: "roses",
            externalRef: null,
            eventId: `${KEY}:sub-1`,
            customerKey: "phone:84900000101",
            source: { page: "/dat-hoa", device: "mobile" },
        })
        expect(contacts.meetChannel).toHaveBeenCalledWith(WORKSPACE, {
            channel: "website",
            account: SITE,
            userId: "submission:sub-1",
            name: "Cam",
        })
        expect(contacts.linkIdentity).toHaveBeenCalledTimes(1)
        expect(contacts.linkIdentity).toHaveBeenCalledWith(
            WORKSPACE,
            CONTACT,
            { kind: "phone", value: "84900000101" },
            { kind: "channel" },
        )
        expect(inbound.mark).not.toHaveBeenCalled()
    })

    it("resolves the existing contact of a returning visitor: the same visitor id meets the contact that holds it", async () => {
        const { sites, contacts, wakes } = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }))
        contacts.meetChannel.mockResolvedValueOnce("existing-contact")

        await expect(sites.submit(KEY, { ...FORM, visitor: VISITOR })).resolves.toMatchObject({
            contactId: "existing-contact",
        })

        expect(contacts.meetChannel.mock.calls[0]?.[1]).toMatchObject({ account: SITE, userId: `visitor:${VISITOR}` })
        expect(contacts.linkIdentity.mock.calls[0]?.[1]).toBe("existing-contact")
        expect(wakes.wake.mock.calls[0]?.[2]).toMatchObject({ contactId: "existing-contact" })
    })
})

describe("WebsiteSitesService submit claims", () => {
    it("keeps an email as a claim, and claims nothing for a visitor who left neither", async () => {
        const first = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }))
        await first.sites.submit(KEY, {
            ...FORM,
            phone: null,
            email: "Cam@Shop.test",
            message: null,
            submissionId: null,
        })
        expect(first.contacts.linkIdentity).toHaveBeenCalledWith(
            WORKSPACE,
            CONTACT,
            { kind: "email", value: "cam@shop.test" },
            { kind: "channel" },
        )

        const second = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }))
        await second.sites.submit(KEY, { ...FORM, phone: null, name: null, visitor: VISITOR, submissionId: null })
        expect(second.contacts.linkIdentity).not.toHaveBeenCalled()
        expect(second.contacts.meetChannel.mock.calls[0]?.[1]).toMatchObject({ userId: `visitor:${VISITOR}`, name: null })
        expect(second.inbound.recordInput.mock.calls[0]?.[0]).toMatchObject({
            customerKey: `web:${VISITOR}`,
            eventId: `${KEY}:00000000-0000-4000-8000-000000000001`,
            senderName: null,
            senderContact: null,
        })
    })

    it("keeps dedupe: the same submission twice is one input, the same contact and one wake key", async () => {
        const { sites, inbound, contacts, wakes } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }),
        )
        inbound.recordInput.mockResolvedValueOnce({ duplicate: false, inboundEventId: "ev-1" })
        inbound.recordInput.mockResolvedValueOnce({ duplicate: true, inboundEventId: "ev-1" })

        await sites.submit(KEY, FORM)
        await expect(sites.submit(KEY, FORM)).resolves.toMatchObject({ duplicate: true, inboundEventId: "ev-1" })

        expect(inbound.recordInput.mock.calls[1]?.[0].eventId).toBe(inbound.recordInput.mock.calls[0]?.[0].eventId)
        expect(contacts.meetChannel.mock.calls[1]?.[1]).toEqual(contacts.meetChannel.mock.calls[0]?.[1])
        expect(wakes.wake.mock.calls[1]?.[2].inboundEventId).toBe("ev-1")
    })
})

describe("WebsiteSitesService submit visitor identity", () => {
    /** A contacts fake that keeps one contact per (account, user id), as the core does for a channel identity. */
    const withStatefulContacts = async (site = siteOf({})) => {
        const built = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, site] }))
        const known = new Map<string, string>()
        built.contacts.meetChannel.mockImplementation((_workspace, person) => {
            const key = `${person.account}|${person.userId}`
            const found = known.get(key) ?? `contact-${known.size + 1}`
            known.set(key, found)
            return Promise.resolve(found)
        })
        return built
    }

    it("meets the same contact for the same visitor id sent twice, with different typed phones", async () => {
        const { sites } = await withStatefulContacts()

        const first = await sites.submit(KEY, { ...FORM, visitor: VISITOR, submissionId: "a" })
        const second = await sites.submit(KEY, { ...FORM, phone: "0911 111 111", visitor: VISITOR, submissionId: "b" })

        expect(second.contactId).toBe(first.contactId)
    })

    it("gives a new contact to every submission that sends no visitor id", async () => {
        const { sites, contacts } = await withStatefulContacts()

        const first = await sites.submit(KEY, { ...FORM, visitor: null, submissionId: "a" })
        const second = await sites.submit(KEY, { ...FORM, visitor: null, submissionId: "b" })

        expect(second.contactId).not.toBe(first.contactId)
        expect(contacts.meetChannel.mock.calls[0]?.[1]).toMatchObject({ userId: "submission:a" })
    })

    it("treats a malformed visitor id as none and still accepts the submission", async () => {
        const { sites, contacts, inbound } = await withStatefulContacts()

        for (const bad of ["v-1", "x".repeat(100), "7c9e6679-7425-40de-944b-e07fc1f90ae", "' or 1=1 --", "  "]) {
            await expect(sites.submit(KEY, { ...FORM, visitor: bad, submissionId: "bad" })).resolves.toMatchObject({
                duplicate: false,
            })
            expect(contacts.meetChannel.mock.lastCall?.[1]).toMatchObject({ userId: "submission:bad" })
        }
        expect(inbound.recordInput.mock.lastCall?.[0]).toMatchObject({ customerKey: "phone:84900000101" })
    })

    it("reads an upper-case visitor id as the same visitor", async () => {
        const { sites } = await withStatefulContacts()

        const first = await sites.submit(KEY, { ...FORM, visitor: VISITOR, submissionId: "a" })
        const second = await sites.submit(KEY, { ...FORM, visitor: VISITOR.toUpperCase(), submissionId: "b" })

        expect(second.contactId).toBe(first.contactId)
    })

    it("scopes the visitor id to the site: the identity is held under the site's own id, so another site meets another contact", async () => {
        const one = await withStatefulContacts(siteOf({}))
        await one.sites.submit(KEY, { ...FORM, visitor: VISITOR })
        const other = await withStatefulContacts(siteOf({ id: "site-2" }))
        await other.sites.submit(KEY, { ...FORM, visitor: VISITOR })

        expect(one.contacts.meetChannel.mock.calls[0]?.[1]).toMatchObject({ account: SITE, userId: `visitor:${VISITOR}` })
        expect(other.contacts.meetChannel.mock.calls[0]?.[1]).toMatchObject({ account: "site-2", userId: `visitor:${VISITOR}` })
    })
})

describe("WebsiteSitesService submit wakes the agent", () => {
    it("wakes the agent of the site with the contact and the submission, after the contact is met; no agent record is written", async () => {
        const { sites, contacts, wakes, owners } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }),
        )

        await sites.submit(KEY, FORM)

        expect(owners.agentOf).toHaveBeenCalledWith(WORKSPACE, AGENT)
        expect(wakes.wake).toHaveBeenCalledWith(WORKSPACE, AGENT, {
            contactId: CONTACT,
            siteId: SITE,
            inboundEventId: "ev-1",
            visitorKey: "submission:sub-1",
            name: "Cam",
            phone: "84900000101",
            email: null,
            request: "roses",
            source: { page: "/dat-hoa", device: "mobile" },
        })
        expect(contacts.meetChannel.mock.invocationCallOrder[0]).toBeLessThan(
            wakes.wake.mock.invocationCallOrder[0] ?? 0,
        )
    })

    it("wakes the installed front door when the site names none", async () => {
        const { sites, wakes, owners } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({ agentId: null })] }),
        )
        owners.agentOf.mockResolvedValueOnce("front-door-1")

        await sites.submit(KEY, FORM)

        expect(wakes.wake).toHaveBeenCalledWith(
            WORKSPACE,
            "front-door-1",
            expect.objectContaining({ contactId: CONTACT }),
        )
    })

    it("refuses the form when no agent owns the site: nothing is stored, no contact is met, nobody is woken", async () => {
        const { sites, contacts, inbound, wakes, owners } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({ agentId: null })] }),
        )
        owners.agentOf.mockResolvedValueOnce(null)

        await expect(sites.submit(KEY, FORM)).rejects.toMatchObject({ code: EntityEngineErrorCode.AgentMissing })

        expect(inbound.recordInput).not.toHaveBeenCalled()
        expect(contacts.meetChannel).not.toHaveBeenCalled()
        expect(contacts.linkIdentity).not.toHaveBeenCalled()
        expect(wakes.wake).not.toHaveBeenCalled()
    })
})

describe("WebsiteSitesService submit refusals", () => {
    it("refuses a key nobody holds, and an intake that is off", async () => {
        const unknown = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, null] }))
        await expect(unknown.sites.submit("nope", FORM)).rejects.toMatchObject({ code: "INBOX_LEADS_SITE_UNKNOWN" })

        const off = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({ isEnabled: false })] }))
        await expect(off.sites.submit(KEY, FORM)).rejects.toMatchObject({ code: "INBOX_LEADS_SITE_OFF" })

        const noForm = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({ formEnabled: false })] }))
        await expect(noForm.sites.submit(KEY, FORM)).rejects.toMatchObject({ code: "INBOX_LEADS_SITE_OFF" })
    })

    it("refuses a form with nothing to answer before anything is written", async () => {
        const { sites, inbound, contacts } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }),
        )

        await expect(sites.submit(KEY, { ...FORM, phone: null, message: " ", email: null })).rejects.toMatchObject({
            code: "INBOX_LEADS_SUBMISSION_EMPTY",
        })

        expect(inbound.recordInput).not.toHaveBeenCalled()
        expect(contacts.meetChannel).not.toHaveBeenCalled()
    })
})

describe("WebsiteSitesService frontDoorSiteOf", () => {
    it("names the site key when the workspace's switched-on site names the agent: nobody else answers it", async () => {
        const em = mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] })
        const { sites } = await build(em)

        await expect(sites.frontDoorSiteOf(WORKSPACE, AGENT)).resolves.toEqual({ siteKey: KEY })
        expect(em.findOne).toHaveBeenCalledWith(WebsiteSiteEntity, { where: { workspaceId: WORKSPACE, agentId: AGENT, isEnabled: true } })
    })

    it("names nothing when no switched-on site names the agent, and creates no site by asking", async () => {
        const em = mockEntityManager({ findOne: [WebsiteSiteEntity, null] })
        const { sites } = await build(em)

        await expect(sites.frontDoorSiteOf(WORKSPACE, AGENT)).resolves.toBeNull()
        expect(em.save).not.toHaveBeenCalled()
    })
})

describe("WebsiteSitesService themeOf", () => {
    const THEME = { hue: 150, chroma: 0.17, lightness: 0.62, base: 0.6, font: "lexend", radius: "large", mode: null }

    it("answers the theme parameters of the workspace behind a switched-on site key, and nothing else of the workspace", async () => {
        const em = mockEntityManager()
        em.findOne.mockResolvedValueOnce(siteOf({ isEnabled: true })).mockResolvedValueOnce({ id: WORKSPACE, theme: { ...THEME, extra: 1 } })
        const { sites } = await build(em)
        await expect(sites.themeOf(KEY)).resolves.toEqual(THEME)
    })

    it("answers null while the workspace wears the NIVO default", async () => {
        const em = mockEntityManager()
        em.findOne.mockResolvedValueOnce(siteOf({ isEnabled: true })).mockResolvedValueOnce({ id: WORKSPACE, theme: null })
        const { sites } = await build(em)
        await expect(sites.themeOf(KEY)).resolves.toBeNull()
    })

    it("refuses an unknown site key and a switched-off site before reading any workspace", async () => {
        const unknown = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, null] }))
        await expect(unknown.sites.themeOf(KEY)).rejects.toMatchObject({ code: "INBOX_LEADS_SITE_UNKNOWN" })
        const off = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({ isEnabled: false })] }))
        await expect(off.sites.themeOf(KEY)).rejects.toMatchObject({ code: "INBOX_LEADS_SITE_OFF" })
    })
})
