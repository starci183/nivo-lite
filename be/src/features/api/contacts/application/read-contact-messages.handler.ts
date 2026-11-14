import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { ContactsService } from "@modules/domain/contacts"
import { ContactConversationService, type CustomerLine } from "@modules/domain/customer-routes"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { ContactMessagesPageView, ContactMessageView, SpeakerView } from "./contact-conversation.contracts"
import { ContactNamesService } from "./contact-names.service"
import { ReadContactMessagesQuery } from "./contacts.queries"

@QueryHandler(ReadContactMessagesQuery)
/**
 * The whole conversation with a person for the contacts page (`contactMessages`): the lines of every route of the contact (or one),
 * merged by time in one keyset-paged read, newest first, with the speaker of each line resolved here: the person, the agent that told it
 * (its name), or the member who typed it (`memberId` of a line is the MEMBERSHIP id, the seat of the person in the workspace). The
 * page seat (owner or manager). A deleted contact (R31) and the routes of a removed connection (R36) answer an empty page.
 */
export class ReadContactMessagesHandler extends ICQRSHandler<ReadContactMessagesQuery, ContactMessagesPageView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly access: AgentWorkAccessService,
        private readonly conversation: ContactConversationService,
        private readonly contacts: ContactsService,
        private readonly names: ContactNamesService,
    ) {
        super(logger)
    }

    protected override async process(query: ReadContactMessagesQuery): Promise<ContactMessagesPageView> {
        const { request, principal } = query.params
        await this.access.manager(principal.id, request.workspaceId)
        const page = await this.conversation.linesOf(request.workspaceId, request.contactId, {
            routeId: request.routeId ?? null,
            before: request.before ?? null,
            limit: request.limit ?? undefined,
        })
        if (page.rows.length === 0) return { rows: [], next: page.next }
        const heardAny = page.rows.some((line) => line.direction === "from_person")
        const [agents, members, person] = await Promise.all([
            this.names.agentsOf(request.workspaceId, page.rows.map((line) => line.agentId)),
            this.names.membersOf(page.rows.map((line) => line.memberId)),
            heardAny ? this.contacts.get(request.workspaceId, request.contactId) : Promise.resolve(null),
        ])
        const speakerOf = (line: CustomerLine): SpeakerView => {
            if (line.direction === "from_person") return { kind: "person", name: person?.displayName ?? null }
            if (line.memberId !== null) return { kind: "staff", name: members.get(line.memberId) ?? null }
            return { kind: "agent", name: line.agentId === null ? null : (agents.get(line.agentId)?.name ?? null) }
        }
        return {
            rows: page.rows.map(
                (line): ContactMessageView => ({
                    id: line.id,
                    routeId: line.routeId,
                    channel: line.channel,
                    accountId: line.accountId,
                    direction: line.direction,
                    saidAt: line.saidAt,
                    text: line.text,
                    files: line.files,
                    order: line.order,
                    state: line.state,
                    speaker: speakerOf(line),
                }),
            ),
            next: page.next,
        }
    }
}
