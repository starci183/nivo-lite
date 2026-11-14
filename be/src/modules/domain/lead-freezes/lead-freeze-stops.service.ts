import { Injectable } from "@nestjs/common"
import { RunStopRecordsService, type RunStop } from "@modules/domain/agent-threads"
import type { HeldStop } from "./lead-freezes.contracts"

/** The most stops of one contact, or of one run, read at once. */
const STOPS_PAGE = 50

/** The most open stops of a workspace read to find those of a conversation (no index pins the conversation of a stop). */
const OPEN_PAGE = 100

/** The open stop a stop is as a freeze reads it, or null for a stop that is not open. */
const heldStopOf = (stop: RunStop): HeldStop | null =>
    stop.state !== "open"
        ? null
        : {
              runId: stop.runId,
              stepKey: stop.stepKey,
              agentId: stop.agentId,
              workflowId: stop.workflowId,
              contactId: stop.contactId,
              conversationId: stop.conversationId,
              toldConversationIds: [...new Set(stop.customerLines.map((line) => line.conversationId).filter((id) => id !== ""))],
              stoppedAt: stop.stoppedAt,
          }

/** The stops once each (a stop of the contact and of the conversation is read twice), in the order first read. */
const distinctOf = (stops: ReadonlyArray<HeldStop>): ReadonlyArray<HeldStop> =>
    stops.filter(
        (stop, at) => stops.findIndex((one) => one.runId === stop.runId && one.stepKey === stop.stepKey) === at,
    )

/** Who a person is, as the reader looks them up: the contact (with the ids merged into it) and the conversation, either may be missing. */
export interface StopCustomer {
    /** The contact, when known. */
    readonly contactId: string | null
    /** The ids merged into the contact, when known. */
    readonly aliases?: ReadonlyArray<string> | undefined
    /** The conversation, when known. */
    readonly conversationId: string | null
}

@Injectable()
/**
 * What a freeze reads of the stops of thread runs (`public.run_stops`, written by the stops of the agent threads only): the open stops
 * of a person and the open stops of one run. Reads only, through the stops' own door; each read is indexed: (contact, state), (run) with
 * the state in code, and (state, moment) for open stops, newest first, the conversation matched in code.
 */
export class LeadFreezeStopsService {
    constructor(private readonly stops: RunStopRecordsService) {}

    /** The open stops about a customer: of their contact (with the ids merged into it), or of their conversation; none when the customer names neither. */
    async openOfCustomer(workspaceId: string, customer: StopCustomer): Promise<ReadonlyArray<HeldStop>> {
        if (customer.contactId === null && customer.conversationId === null) return []
        const people = customer.contactId === null ? [] : [customer.contactId, ...(customer.aliases ?? [])]
        const ofContact = (
            await Promise.all(people.map((id) => this.stops.ofContacts(workspaceId, [id], "open", STOPS_PAGE)))
        )
            .flat()
            .flatMap((stop) => heldStopOf(stop) ?? [])
        const ofConversation =
            customer.conversationId === null
                ? []
                : (await this.stops.newest(workspaceId, "open", OPEN_PAGE))
                      .flatMap((stop) => heldStopOf(stop) ?? [])
                      .filter(
                          (stop) =>
                              stop.conversationId === customer.conversationId ||
                              (customer.conversationId !== null && stop.toldConversationIds.includes(customer.conversationId)),
                      )
        return distinctOf([...ofContact, ...ofConversation])
    }

    /** The open stops of a run, in the order they were written. */
    async openOfRun(workspaceId: string, runId: string): Promise<ReadonlyArray<HeldStop>> {
        return (await this.stops.ofRun(workspaceId, runId)).flatMap((stop) => heldStopOf(stop) ?? [])
    }
}
