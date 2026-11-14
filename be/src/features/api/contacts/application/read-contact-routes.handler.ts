import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { ContactConversationService } from "@modules/domain/customer-routes"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { ContactRouteView } from "./contact-conversation.contracts"
import { ContactNamesService } from "./contact-names.service"
import { ReadContactRoutesQuery } from "./contacts.queries"

@QueryHandler(ReadContactRoutesQuery)
/**
 * The routes of one contact for the contacts page (`contact.routes`): for each the channel, the connection name, when it was last
 * spoken on, the workbench of the agent that spoke last, and the member who holds it (R43). The page seat (owner or manager). A deleted
 * contact (R31) and a route of a removed connection (R36) have none.
 */
export class ReadContactRoutesHandler extends ICQRSHandler<ReadContactRoutesQuery, ReadonlyArray<ContactRouteView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly access: AgentWorkAccessService,
        private readonly conversation: ContactConversationService,
        private readonly names: ContactNamesService,
    ) {
        super(logger)
    }

    protected override async process(query: ReadContactRoutesQuery): Promise<ReadonlyArray<ContactRouteView>> {
        const { request, principal } = query.params
        await this.access.manager(principal.id, request.workspaceId)
        const routes = await this.conversation.routesOf(request.workspaceId, request.contactId)
        if (routes.length === 0) return []
        const [connections, agents, members] = await Promise.all([
            this.names.connectionsOf(request.workspaceId, routes.map((route) => route.accountId)),
            this.names.agentsOf(request.workspaceId, routes.map((route) => route.lastAgentId)),
            this.names.membersOf(routes.map((route) => route.hold?.memberId ?? null)),
        ])
        return routes.map((route): ContactRouteView => {
            const connection = route.accountId === null ? undefined : connections.get(route.accountId)
            const agent = route.lastAgentId === null ? undefined : agents.get(route.lastAgentId)
            return {
                routeId: route.routeId,
                channel: route.channel,
                accountId: route.accountId,
                accountName: connection?.name ?? null,
                provider: connection?.provider ?? null,
                lastLineAt: route.lastLineAt,
                workbench:
                    agent === undefined || agent.installationId === null
                        ? null
                        : { agentId: agent.agentId, agentName: agent.name, moduleKey: agent.moduleKey, installationId: agent.installationId },
                holder:
                    route.hold === null
                        ? null
                        : { memberId: route.hold.memberId, name: members.get(route.hold.memberId) ?? null, at: route.hold.at },
            }
        })
    }
}
