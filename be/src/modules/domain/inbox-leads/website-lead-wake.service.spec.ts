import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentTagService } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WEBSITE_CONTACT_ROUTES } from "./inbox-leads.decorators"
import type { WebsiteContactRoutes } from "./inbox-leads.decorators"
import { InboxLeadsLogEvent } from "./inbox-leads.log-events"
import { WebsiteLeadWakeService } from "./website-lead-wake.service"
import type { WebsiteLeadFacts } from "./website-lead-wake.policy"

const WORKSPACE = "ws-1"
const AGENT = "agent-1"

const FACTS: WebsiteLeadFacts = {
    leadId: "lead-1",
    inboundEventId: "ev-1",
    name: "Cam",
    phone: "84900000101",
    email: null,
    request: "roses",
    source: { page: "/dat-hoa" },
}

const contextOf = (route: "zns" | "owner_item") => ({
    kind: "website-lead",
    leadId: "lead-1",
    inboundEventId: "ev-1",
    contact: { name: "Cam", phone: "84900000101", email: null },
    request: "roses",
    source: { page: "/dat-hoa" },
    chat: false,
    firstContact: { route, via: "phone" },
})

const build = async (carried?: ReadonlyArray<"zns" | "sms">) => {
    const routes = mock<WebsiteContactRoutes>()
    routes.routesOf.mockResolvedValue(carried ?? [])
    const tags = mock<AgentTagService>()
    const directory = mock<AgentDirectoryService>()
    const logger = mock<Logger>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    tags.tagAgent.mockResolvedValue({ tagged: true, wakeId: "w-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebsiteLeadWakeService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: AgentDirectoryService, useValue: directory },
            { provide: AgentTagService, useValue: tags },
            ...(carried === undefined ? [] : [{ provide: WEBSITE_CONTACT_ROUTES, useValue: routes }]),
        ],
    }).compile()
    return { wakes: moduleRef.get(WebsiteLeadWakeService), tags, directory, logger }
}

describe("WebsiteLeadWakeService targetOf", () => {
    it("keeps the agent the owner picked without asking the directory", async () => {
        const { wakes, directory } = await build()

        await expect(wakes.targetOf(WORKSPACE, AGENT)).resolves.toBe(AGENT)
        expect(directory.firstActiveIdOfModule).not.toHaveBeenCalled()
    })

    it("defaults to the oldest active Sales agent, or none", async () => {
        const { wakes, directory } = await build()
        directory.firstActiveIdOfModule.mockResolvedValueOnce("sales-1").mockResolvedValueOnce(null)

        await expect(wakes.targetOf(WORKSPACE, null)).resolves.toBe("sales-1")
        await expect(wakes.targetOf(WORKSPACE, null)).resolves.toBeNull()
        expect(directory.firstActiveIdOfModule).toHaveBeenCalledWith(WORKSPACE, "sales")
    })
})

describe("WebsiteLeadWakeService wake", () => {
    it("tags the agent through the one tag door, as a system event about the customer, keyed by the input", async () => {
        const { wakes, tags, logger } = await build()

        await expect(wakes.wake(WORKSPACE, AGENT, FACTS)).resolves.toBe(true)

        expect(tags.tagAgent).toHaveBeenCalledWith({
            source: "website_lead",
            workspaceId: WORKSPACE,
            toAgentId: AGENT,
            text: 'vi:inboxLeads.websiteLeadTag:{"who":"Cam","request":"roses"}',
            subject: "lead:lead-1",
            channel: "website",
            leadId: "lead-1",
            locale: "vi",
            context: contextOf("owner_item"),
            eventKey: "website-lead:ev-1",
        })
        expect(logger.info).toHaveBeenCalledWith(InboxLeadsLogEvent.WebsiteLeadWoke, {
            leadId: "lead-1",
            agentId: AGENT,
            route: "owner_item",
        })
    })

    it("names the ZNS route only when a connection carries it", async () => {
        const { wakes, tags } = await build(["zns"])

        await wakes.wake(WORKSPACE, AGENT, FACTS)

        expect(tags.tagAgent.mock.calls[0]?.[0].context).toEqual(contextOf("zns"))
    })

    it("writes nothing and says so when no agent can receive the customer", async () => {
        const { wakes, tags, logger } = await build()

        await expect(wakes.wake(WORKSPACE, null, FACTS)).resolves.toBe(false)

        expect(tags.tagAgent).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(InboxLeadsLogEvent.WebsiteLeadNoAgent, { leadId: "lead-1" })
    })

    it("answers false for a form already woken, with the reason logged", async () => {
        const { wakes, tags, logger } = await build()
        tags.tagAgent.mockResolvedValueOnce({ tagged: false, reason: "duplicate" })

        await expect(wakes.wake(WORKSPACE, AGENT, FACTS)).resolves.toBe(false)

        expect(logger.info).toHaveBeenCalledWith(InboxLeadsLogEvent.WebsiteLeadNotWoken, {
            leadId: "lead-1",
            reason: "duplicate",
        })
    })
})
