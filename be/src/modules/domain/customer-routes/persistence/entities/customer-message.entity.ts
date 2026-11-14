import type { FileNotKept } from "@modules/domain/chat-files"
import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

/** Who a line is from: the person (`from_person`) or the shop (`to_person`: any agent, the engine's own line, a member's typed reply). */
export type CustomerMessageDirection = "from_person" | "to_person"

/** A file of a line as the row keeps it: an address, never the bytes. */
export interface CustomerMessageFileValue {
    /** Where the file is served from; null for a file the person sent that could not be kept (`notKept` says why). */
    readonly url: string | null
    /** Why a file the person sent was not kept (chat-files `FileNotKept`); absent for a kept file. */
    readonly notKept?: FileNotKept | undefined
    /** The name of the file, or empty. */
    readonly name: string
    /** The media type, or empty when the sender did not say. */
    readonly contentType: string
    /** The caption a sent picture carried, when it had one. */
    readonly caption?: string | undefined
}

@Entity({ schema: "public", name: "customer_messages" })
/**
 * THE CONVERSATION WITH A CUSTOMER, both directions, as engine data (owner ruling R26): ONE row per line said on a route. A line the
 * person said is written once by the engine's one delivery function (keyed by the source's own id of the message on the route); a line
 * said to the person is the send's ledger row (keyed by the send key in the workspace: claimed before the provider is asked, settled
 * after). `said_at` then `seq` is the order of the thread. No blob: files are addresses.
 */
export class CustomerMessageEntity extends UuidAbstractEntity {
    /** The insertion order (the database sets it): the tie-break of the thread and the cursor of a page. A bigint comes back as text. */
    @Column({ name: "seq", type: "bigint", insert: false, update: false })
    seq!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The route the line was said on (this person on this account). */
    @Column({ name: "route_id", type: "uuid" })
    routeId!: string

    /** The person, as their id was when the line was said (merges are followed at read time). */
    @Column({ name: "contact_id", type: "uuid" })
    contactId!: string

    /** Who the line is from. */
    @Column({ name: "direction", type: "text" })
    direction!: CustomerMessageDirection

    /** The once-key: the send key (`to_person`), or the source's own id of the message (`from_person`). */
    @Column({ name: "line_key", type: "text" })
    lineKey!: string

    /** When it was said: the channel's time of a heard line (never after its receipt), the claim of a sent one. */
    @Column({ name: "said_at", type: "timestamptz" })
    saidAt!: Date

    /** The words (empty for a line of files only). */
    @Column({ name: "text", type: "text" })
    text!: string

    /** The files of the line, by address. */
    @Column({ name: "files", type: "jsonb" })
    files!: ReadonlyArray<CustomerMessageFileValue>

    /** How many files went with a sent line (the sender's own count, also when it gave no addresses). */
    @Column({ name: "attachment_count", type: "integer" })
    attachmentCount!: number

    /** The kinds of those files (`image`, `file`, ...), in order. */
    @Column({ name: "attachment_kinds", type: "jsonb" })
    attachmentKinds!: ReadonlyArray<string>

    /** The order snapshot a sent line showed the customer (the send's generic `LineOrder`), or null. */
    @Column({ name: "order_card", type: "jsonb", nullable: true })
    orderCard!: object | null

    /** The canonical event a heard line came in with, or null. */
    @Column({ name: "event_id", type: "text", nullable: true })
    eventId!: string | null

    /** The agent that told a sent line, or null (a heard line, or once that agent is gone). */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** The member of the shop who typed a sent line, or null. */
    @Column({ name: "member_id", type: "uuid", nullable: true })
    memberId!: string | null

    /** The run that told it, or null. */
    @Column({ name: "run_id", type: "uuid", nullable: true })
    runId!: string | null

    /** The step of the run, or null. */
    @Column({ name: "step_key", type: "text", nullable: true })
    stepKey!: string | null

    /** A sent line's `claimed`, `delivered`, `refused` or `unknown`; null for a heard line. */
    @Column({ name: "state", type: "text", nullable: true })
    state!: string | null

    /** Why it was refused, or what is known of an unknown outcome; null otherwise. */
    @Column({ name: "reason", type: "text", nullable: true })
    reason!: string | null

    /** The id the provider gave a sent message, or null. */
    @Column({ name: "provider_message_id", type: "text", nullable: true })
    providerMessageId!: string | null

    /** The channel. */
    @Column({ name: "channel", type: "text" })
    channel!: string

    /** The connection, site or API key of the entrance, or null. */
    @Column({ name: "account_id", type: "uuid", nullable: true })
    accountId!: string | null

    /** When the provider took a sent line, or null. */
    @Column({ name: "delivered_at", type: "timestamptz", nullable: true })
    deliveredAt!: Date | null
}
