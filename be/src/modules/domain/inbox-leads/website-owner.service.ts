import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WEBSITE_CHANNEL, installedFrontDoorsOf } from "@modules/domain/installed-plugins"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { WebsiteSiteEntity } from "./persistence/entities"

@Injectable()
/**
 * The one answer to "which agent owns this website": the agent the site row names while it still exists, else the workspace's installed
 * front door of the website stream, read from the installation (the template agents with a graph that wakes on a customer message of the
 * website, a private plugin's template first, then the installation's order; never named here), else none. A form's wake and the records of a
 * website chat are this agent's, so they have the same owner.
 */
export class WebsiteOwnerService {
    constructor(
        private readonly directory: AgentDirectoryService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    /** The owning agent of a site that names `siteAgentId` (or none): the named agent when it exists, else the installed front door, else null. */
    async agentOf(workspaceId: string, siteAgentId: string | null): Promise<string | null> {
        if (siteAgentId !== null && (await this.directory.find(workspaceId, siteAgentId)) !== null) return siteAgentId
        return this.frontDoorOf(workspaceId)
    }

    /** The owning agent of the website site with this id (the entrance a website chat conversation carries); null when the site is not the workspace's. */
    async agentOfSite(workspaceId: string, siteId: string): Promise<string | null> {
        const site = await this.entityManager.findOne(WebsiteSiteEntity, { where: { workspaceId, id: siteId } })
        return site === null ? null : this.agentOf(workspaceId, site.agentId)
    }

    /** The oldest active agent of the first installed front door of the website stream the workspace holds, or null when it holds none. */
    private async frontDoorOf(workspaceId: string): Promise<string | null> {
        const modules = installedFrontDoorsOf(WEBSITE_CHANNEL)
        let first: string | null = null
        await eachInOrder(modules, async (module) => {
            first ??= await this.directory.firstActiveIdOfModule(workspaceId, module)
        })
        return first
    }
}
