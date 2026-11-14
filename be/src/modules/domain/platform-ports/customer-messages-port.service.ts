import { Injectable } from "@nestjs/common"
import type { CustomerLine as PortLine, CustomerMessages, CustomerMessagesAsk } from "@nivo-lite/agent-sdk/platform"
import { CustomerMessagesService, type CustomerLine, type LinePageAsk } from "@modules/domain/customer-routes"

const lineOf = (line: CustomerLine): PortLine => ({
    id: line.id,
    routeId: line.routeId,
    contactId: line.contactId,
    direction: line.direction,
    saidAt: line.saidAt,
    text: line.text,
    // The SDK's line file has an address only (NEED posted: `notKept` and a nullable address on the SDK's `CustomerLineFile`); until it
    // carries the reason, a file the shop could not keep reaches a package with no address, as before.
    files: line.files.map((file) => ({ ...file, url: file.url ?? "" })),
    order: line.order,
    agentId: line.agentId,
    memberId: line.memberId,
    state: line.state,
    reason: line.reason,
    channel: line.channel,
    accountId: line.accountId,
    deliveredAt: line.deliveredAt,
})

/** The port's ask is the service's page ask, every state of a sent line included (a people-facing read shows what failed too). */
const pageAskOf = (ask: CustomerMessagesAsk): LinePageAsk => ({ limit: ask.limit, after: ask.after, since: ask.since, told: "all" })

@Injectable()
/**
 * The `platform.customer-messages` port: the conversation with the customers (the engine's `customer_messages`), both directions, every
 * agent's lines and the members' typed replies, read-only and bounded (at most 100 lines a page, newest first, a cursor). It is scoped to
 * the workspace of the door run and NOT narrowed by an agent: the conversation is the person's, so a people-facing read (the workbench
 * thread, the contacts page) and an agent-scoped service call see the same lines. The permission of the read itself was proven by the door;
 * a route or contact id of another workspace answers an empty page. A person merged into another is read under the survivor, and the
 * lines of a deleted contact are left out, both by the lines service this port only maps.
 */
export class CustomerMessagesPortService {
    constructor(private readonly messages: CustomerMessagesService) {}

    /** The port for one workspace. */
    portFor(workspaceId: string): CustomerMessages {
        return {
            byRoute: async (routeId, ask = {}) => {
                const page = await this.messages.threadOf(workspaceId, routeId, pageAskOf(ask))
                return { lines: page.rows.map((row) => lineOf(row)), next: page.next }
            },
            byContact: async (contactId, ask = {}) => {
                const page = await this.messages.ofContact(workspaceId, contactId, pageAskOf(ask))
                return { lines: page.rows.map((row) => lineOf(row)), next: page.next }
            },
        }
    }
}
