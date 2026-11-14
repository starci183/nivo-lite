import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { CustomerMessagesService, type LinePage } from "@modules/domain/customer-routes"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadCustomerMessagesQuery } from "./contacts.queries"

@QueryHandler(ReadCustomerMessagesQuery)
/**
 * `nivo.api.nivo.customer.message.list`: the conversation with a person on one route, both directions, every state, newest first, with a
 * cursor (owner ruling R26: engine data). The contacts page's permission (the conversation is the person's, not one agent's); a route
 * of another workspace, and the route of a deleted contact (soft delete, R31: the lines stay, reads skip them), answer an empty page.
 */
export class ReadCustomerMessagesHandler extends ICQRSHandler<ReadCustomerMessagesQuery, LinePage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly access: AgentWorkAccessService,
        private readonly lines: CustomerMessagesService,
    ) {
        super(logger)
    }

    protected override async process(query: ReadCustomerMessagesQuery): Promise<LinePage> {
        const { request, principal } = query.params
        await this.access.manager(principal.id, request.workspaceId)
        return this.lines.threadOf(request.workspaceId, request.routeId, {
            limit: request.limit ?? undefined,
            after: request.after ?? null,
            since: request.since ?? null,
        })
    }
}
