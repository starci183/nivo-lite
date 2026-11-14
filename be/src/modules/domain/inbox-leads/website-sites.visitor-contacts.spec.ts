import { Test } from "@nestjs/testing"
import { fakeIds, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsService } from "@modules/domain/connections"
import { ContactsService } from "@modules/domain/contacts"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import {
    CONTACTS_WORKSPACE,
    MemoryContactMemory,
    MemoryContactsStore,
    OTHER_WORKSPACE,
} from "@tests/fixtures/builders/contacts.builder"
import { WEBSITE_KEY as KEY, websiteSite as siteOf } from "@tests/fixtures/builders/website-site.builder"
import { websiteIntakeEntities } from "./persistence/entities"
import { WebsiteLeadWakeService } from "./website-lead-wake.service"
import { WebsiteOwnerService } from "./website-owner.service"
import { WebsiteSitesService } from "./website-sites.service"
import type { WebsiteSubmission } from "./website-sites.service"

// The website intake over the REAL contacts (their identity rules, an in-memory store): the visitor id the hosted form keeps per browser is
// a `channel` identity (channel `website`, account = the site, value `visitor:<id>`) vouched for by the channel (our own script), so
// the same browser is the same contact; the phone and the mail typed into the form are claims (proposals), never a merge.
// Ledger (TOOLS-LEAD F2): the intake's own spec (`website-sites.service.spec.ts`) stands over a contacts fake; this one proves the contract
// with the real identity rules. The kind is `channel`, not a literal `website-visitor` kind: no new column or kind value was needed (concept
// `contacts`, rule 11).

const [WebsiteSiteEntity] = websiteIntakeEntities
const NOW = new Date("2026-11-13T08:00:00.000Z")
const VISITOR_A = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
const VISITOR_B = "0f8fad5b-d9cb-469f-a165-70867728950e"

const FORM: WebsiteSubmission = {
    name: "Cam",
    phone: null,
    email: null,
    message: "roses",
    pagePath: null,
    campaign: null,
    device: null,
    visitor: VISITOR_A,
    submissionId: "sub-1",
}

/** One intake of a site (workspace + site id) over a shared contacts store. */
const intakeOf = async (store: MemoryContactsStore, workspaceId: string, siteId: string) => {
    const contacts = new ContactsService(store, { now: () => NOW }, new MemoryContactMemory())
    const inbound = mock<InboundEventsService>()
    inbound.recordInput.mockResolvedValue({ duplicate: false, inboundEventId: "ev-1" })
    const owners = mock<WebsiteOwnerService>()
    owners.agentOf.mockImplementation((_workspace, siteAgent) => Promise.resolve(siteAgent))
    const wakes = mock<WebsiteLeadWakeService>()
    wakes.wake.mockResolvedValue(true)
    const site = siteOf({ id: siteId, workspaceId })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebsiteSitesService,
            { provide: WorkspaceMembersService, useValue: mock<WorkspaceMembersService>() },
            { provide: ConnectionsService, useValue: mock<ConnectionsService>() },
            { provide: AgentDirectoryService, useValue: mock<AgentDirectoryService>() },
            { provide: ContactsService, useValue: contacts },
            { provide: InboundEventsService, useValue: inbound },
            { provide: WebsiteLeadWakeService, useValue: wakes },
            { provide: WebsiteOwnerService, useValue: owners },
            { provide: IDS, useValue: fakeIds() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager({ findOne: [WebsiteSiteEntity, site] }) },
        ],
    }).compile()
    return { sites: moduleRef.get(WebsiteSitesService), contacts, wakes }
}

describe("the website intake meets visitors through the real contacts", () => {
    it("meets one contact for the same visitor id sent twice, and the id is a channel identity of the site verified by the channel", async () => {
        const store = new MemoryContactsStore()
        const { sites } = await intakeOf(store, CONTACTS_WORKSPACE, "site-1")

        const first = await sites.submit(KEY, FORM)
        const second = await sites.submit(KEY, { ...FORM, submissionId: "sub-2", message: "more roses" })

        expect(second.contactId).toBe(first.contactId)
        expect(store.contacts).toHaveLength(1)
        expect(store.identities).toEqual([
            expect.objectContaining({
                contactId: first.contactId,
                kind: "channel",
                provider: "website",
                account: "site-1",
                value: `visitor:${VISITOR_A}`,
                verified: true,
                verifiedBy: "channel",
            }),
        ])
    })

    it("meets two contacts for two visitors", async () => {
        const store = new MemoryContactsStore()
        const { sites } = await intakeOf(store, CONTACTS_WORKSPACE, "site-1")

        const one = await sites.submit(KEY, FORM)
        const two = await sites.submit(KEY, { ...FORM, visitor: VISITOR_B, submissionId: "sub-2" })

        expect(two.contactId).not.toBe(one.contactId)
    })

    it("meets another contact for the same visitor id under another site, and under another workspace", async () => {
        const store = new MemoryContactsStore()
        const here = await intakeOf(store, CONTACTS_WORKSPACE, "site-1")
        const otherSite = await intakeOf(store, CONTACTS_WORKSPACE, "site-2")
        const otherWorkspace = await intakeOf(store, OTHER_WORKSPACE, "site-3")

        const first = await here.sites.submit(KEY, FORM)
        const second = await otherSite.sites.submit(KEY, { ...FORM, submissionId: "sub-2" })
        const third = await otherWorkspace.sites.submit(KEY, { ...FORM, submissionId: "sub-3" })

        expect(new Set([first.contactId, second.contactId, third.contactId]).size).toBe(3)
    })

    it("meets a new contact for every submission that sends no visitor id (or a malformed one)", async () => {
        const store = new MemoryContactsStore()
        const { sites } = await intakeOf(store, CONTACTS_WORKSPACE, "site-1")

        const first = await sites.submit(KEY, { ...FORM, visitor: null, submissionId: "a" })
        const second = await sites.submit(KEY, { ...FORM, visitor: "not-a-visitor-id", submissionId: "b" })

        expect(second.contactId).not.toBe(first.contactId)
    })

    it("keeps a typed phone as a proposal: it merges nothing with the contact that holds it verified, and raises a suggestion", async () => {
        const store = new MemoryContactsStore()
        const holder = store.seed(CONTACTS_WORKSPACE, "Lan", [
            { kind: "phone", provider: "", account: "", value: "84912345678", proof: "token" },
        ])
        const { sites, contacts } = await intakeOf(store, CONTACTS_WORKSPACE, "site-1")

        const met = await sites.submit(KEY, { ...FORM, phone: "0912 345 678" })

        expect(met.contactId).not.toBe(holder)
        expect(store.merges).toEqual([])
        expect(store.contacts).toHaveLength(2)
        await expect(contacts.suggestionsOf(CONTACTS_WORKSPACE, met.contactId)).resolves.toContainEqual({
            contactId: holder,
            why: "claimed_identity",
            identity: { kind: "phone", provider: "", account: "", value: "84912345678" },
        })
    })
})
