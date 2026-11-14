import { mock } from "@starci/jest-preset"
import { ChannelFrontDoorService } from "@modules/domain/agent-instances"
import type { FrontDoorOutcome } from "@modules/domain/agent-instances"
import { WebsiteSitesService } from "@modules/domain/inbox-leads"
import type { WebsiteSiteView } from "@modules/domain/inbox-leads"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { SaveWebsiteSiteCommand } from "./save-website-site.command"
import { SaveWebsiteSiteHandler } from "./save-website-site.handler"

const WORKSPACE = "ws-1"
const PRINCIPAL: Principal = { id: "user-1", role: "authenticated" }

const viewOf = (over: Partial<WebsiteSiteView>): WebsiteSiteView => ({
    siteKey: "k",
    isEnabled: true,
    chatEnabled: true,
    formEnabled: true,
    pricesEnabled: false,
    agentId: null,
    formUrl: "https://x/form/k",
    ...over,
})

const run = async (saved: WebsiteSiteView, outcome: FrontDoorOutcome) => {
    const sites = mock<WebsiteSitesService>()
    const frontDoor = mock<ChannelFrontDoorService>()
    sites.save.mockResolvedValue(saved)
    sites.adoptFrontDoor.mockResolvedValue(viewOf({ agentId: "front-1" }))
    frontDoor.ensureForWebsite.mockResolvedValue(outcome)
    const handler = new SaveWebsiteSiteHandler(mock<Logger>(), sites, frontDoor)
    const command = new SaveWebsiteSiteCommand({
        request: { workspaceId: WORKSPACE, change: { isEnabled: true } },
        principal: PRINCIPAL,
    })
    const view = await handler.execute(command)
    return { view, sites, frontDoor }
}

describe("SaveWebsiteSiteHandler", () => {
    it("writes the installed front door onto the site row", async () => {
        const { view, sites } = await run(viewOf({}), {
            kind: "installed",
            module: "sales",
            agentId: "front-1",
            installationId: "i-1",
        })

        expect(sites.adoptFrontDoor).toHaveBeenCalledWith("user-1", WORKSPACE, "front-1")
        expect(view.agentId).toBe("front-1")
    })

    it("writes the held front door too, and touches nothing when the intake is off or no front door exists", async () => {
        const held = await run(viewOf({}), { kind: "held", module: "sales", agentId: "front-1" })
        expect(held.sites.adoptFrontDoor).toHaveBeenCalledWith("user-1", WORKSPACE, "front-1")

        const off = await run(viewOf({ isEnabled: false }), { kind: "none" })
        expect(off.frontDoor.ensureForWebsite).not.toHaveBeenCalled()
        expect(off.sites.adoptFrontDoor).not.toHaveBeenCalled()

        const none = await run(viewOf({}), { kind: "none" })
        expect(none.sites.adoptFrontDoor).not.toHaveBeenCalled()
        expect(none.view.agentId).toBeNull()
    })
})
