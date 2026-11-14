import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentCard } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    WEBSITE_AGENT as AGENT,
    WEBSITE_WORKSPACE as WORKSPACE,
    websiteSite as siteOf,
} from "@tests/fixtures/builders/website-site.builder"
import { websiteIntakeEntities } from "./persistence/entities"
import { WebsiteOwnerService } from "./website-owner.service"

const [WebsiteSiteEntity] = websiteIntakeEntities

const build = async (em = mockEntityManager()) => {
    const directory = mock<AgentDirectoryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebsiteOwnerService,
            { provide: AgentDirectoryService, useValue: directory },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
        ],
    }).compile()
    return { owners: moduleRef.get(WebsiteOwnerService), directory }
}

describe("WebsiteOwnerService agentOf", () => {
    it("is the agent the site names while it exists, without asking for a front door", async () => {
        const { owners, directory } = await build()
        directory.find.mockResolvedValueOnce(mock<AgentCard>())

        await expect(owners.agentOf(WORKSPACE, AGENT)).resolves.toBe(AGENT)
        expect(directory.firstActiveIdOfModule).not.toHaveBeenCalled()
    })

    it("is the installed front door of the website stream when the site names none, read from the installation", async () => {
        const { owners, directory } = await build()
        directory.firstActiveIdOfModule.mockResolvedValueOnce("front-1")

        await expect(owners.agentOf(WORKSPACE, null)).resolves.toBe("front-1")
        const [workspace, module] = directory.firstActiveIdOfModule.mock.calls[0] ?? []
        expect(workspace).toBe(WORKSPACE)
        expect(typeof module).toBe("string")
    })

    it("falls back to the front door when the agent the site names was deleted", async () => {
        const { owners, directory } = await build()
        directory.find.mockResolvedValueOnce(null)
        directory.firstActiveIdOfModule.mockResolvedValueOnce("front-1")

        await expect(owners.agentOf(WORKSPACE, AGENT)).resolves.toBe("front-1")
    })

    it("is none when no agent is named and no front door is installed", async () => {
        const { owners, directory } = await build()
        directory.firstActiveIdOfModule.mockResolvedValue(null)

        await expect(owners.agentOf(WORKSPACE, null)).resolves.toBeNull()
    })
})

describe("WebsiteOwnerService agentOfSite", () => {
    it("resolves a site by id to its owning agent", async () => {
        const { owners, directory } = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, siteOf({})] }))
        directory.find.mockResolvedValueOnce(mock<AgentCard>())

        await expect(owners.agentOfSite(WORKSPACE, "site-1")).resolves.toBe(AGENT)
    })

    it("is none for a site the workspace does not hold", async () => {
        const { owners, directory } = await build(mockEntityManager({ findOne: [WebsiteSiteEntity, null] }))

        await expect(owners.agentOfSite(WORKSPACE, "nope")).resolves.toBeNull()
        expect(directory.firstActiveIdOfModule).not.toHaveBeenCalled()
    })
})
