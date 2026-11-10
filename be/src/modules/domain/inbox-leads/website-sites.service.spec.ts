import { Test } from "@nestjs/testing"
import { fakeIds, mock, mockEntityManager } from "@starci/jest-preset"
import type { EngineResult, EntitiesApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentCard } from "@modules/domain/agents"
import { ConnectionsService } from "@modules/domain/connections"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
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
import { inboxLeadsEntities } from "./persistence/entities"
import { WebsiteLeadWakeService } from "./website-lead-wake.service"
import { WebsiteSitesService } from "./website-sites.service"
import type { WebsiteSubmission } from "./website-sites.service"

const [WebsiteSiteEntity] = inboxLeadsEntities
const LEAD = "33333333-3333-4333-8333-333333333333"

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

const written = (id: string): EngineResult => ({ ok: true, row: mock<RecordRow>({ id }), version: "1" })

const build = async (em = mockEntityManager()) => {
    const members = mock<WorkspaceMembersService>()
    const connections = mock<ConnectionsService>()
    const directory = mock<AgentDirectoryService>()
    const engine = mock<EntityEngineService>()
    const ports = mock<EntityPortsService>()
    const inbound = mock<InboundEventsService>()
    const wakes = mock<WebsiteLeadWakeService>()
    const api = mock<EntitiesApi>()
    members.require.mockResolvedValue(mock<WorkspaceMember>())
    connections.publicOrigin.mockReturnValue("https://nivo.example")
    engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
    ports.entitiesApi.mockReturnValue(api)
    inbound.recordInput.mockResolvedValue({ duplicate: false, inboundEventId: "ev-1" })
    wakes.targetOf.mockImplementation((_workspace, siteAgent) => Promise.resolve(siteAgent))
    wakes.wake.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebsiteSitesService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ConnectionsService, useValue: connections },
            { provide: AgentDirectoryService, useValue: directory },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            { provide: InboundEventsService, useValue: inbound },
            { provide: WebsiteLeadWakeService, useValue: wakes },
            { provide: IDS, useValue: fakeIds() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
        ],
    }).compile()
    return { sites: moduleRef.get(WebsiteSitesService), members, connections, directory, inbound, wakes, api, em }
}

describe("WebsiteSitesService view", () => {
    it("shows the intake with the address of the hosted form", async () => {
        const { sites } = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }))

        await expect(sites.view("user-1", WORKSPACE)).resolves.toMatchObject({
            siteKey: KEY,
            agentId: AGENT,
            formUrl: `https://nivo.example/w/${KEY}`,
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
        expect(view).toMatchObject({ agentId: null, formUrl: `https://site.example/w/${KEY}` })
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

describe("WebsiteSitesService submit", () => {
    it("makes one input and one customer of the form, found by phone and given to the agent of the site", async () => {
        const { sites, api, inbound } = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }))
        api.ensure.mockResolvedValueOnce(written(LEAD))

        await expect(sites.submit(KEY, FORM)).resolves.toEqual({
            leadId: LEAD,
            inboundEventId: "ev-1",
            duplicate: false,
        })

        expect(api.ensure).toHaveBeenCalledWith("sales.lead", "phone", {
            contactName: "Cam",
            channel: "website",
            owner: AGENT,
            need: "roses",
            phone: "84900000101",
        })
        expect(inbound.recordInput).toHaveBeenCalledWith({
            workspaceId: WORKSPACE,
            channel: "website",
            kind: "lead",
            senderName: "Cam",
            senderContact: "84900000101",
            body: "roses",
            externalRef: null,
            eventId: `${KEY}:sub-1`,
            customerKey: "phone:84900000101",
            source: { page: "/dat-hoa", device: "mobile" },
        })
        expect(inbound.mark).toHaveBeenCalledWith(WORKSPACE, "ev-1", null, LEAD)
    })

    it("finds a customer without a phone by email", async () => {
        const { sites, api } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({ agentId: null })] }),
        )
        api.ensure.mockResolvedValueOnce(written(LEAD))

        await sites.submit(KEY, { ...FORM, phone: null, email: "Cam@Shop.test", message: null, submissionId: null })

        expect(api.ensure).toHaveBeenCalledWith("sales.lead", "email", {
            contactName: "Cam",
            channel: "website",
            email: "cam@shop.test",
        })
    })

    it("makes a customer of a visitor with neither, grouped under the id the page gave", async () => {
        const { sites, api, inbound } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({ agentId: null })] }),
        )
        api.insert.mockResolvedValueOnce(written(LEAD))

        await sites.submit(KEY, { ...FORM, phone: null, name: null, visitor: "v-1", submissionId: null })

        expect(api.insert).toHaveBeenCalledWith("sales.lead", {
            contactName: "website",
            channel: "website",
            need: "roses",
        })
        expect(inbound.recordInput.mock.calls[0]?.[0]).toMatchObject({
            customerKey: "web:v-1",
            eventId: `${KEY}:00000000-0000-4000-8000-000000000001`,
            senderName: null,
            senderContact: null,
        })
    })
})

describe("WebsiteSitesService submit wakes the agent", () => {
    it("wakes the agent of the site with the facts of the form, after the input is marked", async () => {
        const { sites, api, inbound, wakes } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }),
        )
        api.ensure.mockResolvedValueOnce(written(LEAD))

        await sites.submit(KEY, FORM)

        expect(wakes.targetOf).toHaveBeenCalledWith(WORKSPACE, AGENT)
        expect(wakes.wake).toHaveBeenCalledWith(WORKSPACE, AGENT, {
            leadId: LEAD,
            inboundEventId: "ev-1",
            name: "Cam",
            phone: "84900000101",
            email: null,
            request: "roses",
            source: { page: "/dat-hoa", device: "mobile" },
        })
        expect(inbound.mark.mock.invocationCallOrder[0]).toBeLessThan(wakes.wake.mock.invocationCallOrder[0] ?? 0)
    })

    it("gives the customer to the default agent when the site names none", async () => {
        const { sites, api, wakes } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({ agentId: null })] }),
        )
        wakes.targetOf.mockResolvedValueOnce("sales-1")
        api.ensure.mockResolvedValueOnce(written(LEAD))

        await sites.submit(KEY, FORM)

        expect(api.ensure).toHaveBeenCalledWith("sales.lead", "phone", expect.objectContaining({ owner: "sales-1" }))
        expect(wakes.wake).toHaveBeenCalledWith(WORKSPACE, "sales-1", expect.objectContaining({ leadId: LEAD }))
    })

    it("still stores the customer when no agent can receive it", async () => {
        const { sites, api, wakes } = await build(
            mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({ agentId: null })] }),
        )
        wakes.targetOf.mockResolvedValueOnce(null)
        api.ensure.mockResolvedValueOnce(written(LEAD))

        await expect(sites.submit(KEY, FORM)).resolves.toMatchObject({ leadId: LEAD })

        expect(wakes.wake).toHaveBeenCalledWith(WORKSPACE, null, expect.objectContaining({ leadId: LEAD }))
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

    it("refuses a form with nothing to answer, and a write the engine refuses", async () => {
        const { sites, api } = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }))

        await expect(sites.submit(KEY, { ...FORM, phone: null, message: " ", email: null })).rejects.toMatchObject({
            code: "INBOX_LEADS_SUBMISSION_EMPTY",
        })

        api.ensure.mockResolvedValueOnce({ ok: false, reason: "stale" })
        await expect(sites.submit(KEY, FORM)).rejects.toMatchObject({ code: "INBOX_LEADS_WRITE_REFUSED" })
    })
})
