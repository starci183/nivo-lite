import { builder } from "@starci/jest-preset"
import { inboundEventsEntities } from "@modules/domain/inbound-events"
import type { InboundEventsService } from "@modules/domain/inbound-events"
import type { MockEntityManager } from "@starci/jest-preset"
import type { QueryBuilderAnswers } from "./entity-query-builder-fake.builder"

const InboundEventEntity: (typeof inboundEventsEntities)[0] = inboundEventsEntities[0]
type InboundEventEntity = InstanceType<typeof InboundEventEntity>

/** The input a channel delivered to `recordInput`. */
export type InboundInputOf = Parameters<InboundEventsService["recordInput"]>[0]

/** The moment the fake clock of the inbound events specs stands at. */
export const INBOUND_NOW = "2026-10-12T10:00:00.000Z"

/** What the function held by the named field of a value answers when it is called. */
export const runField = (value: unknown, field: string): unknown => {
    const fn: unknown = Reflect.get(Object(value), field)
    return typeof fn === "function" ? Reflect.apply(fn, undefined, []) : undefined
}

/** The answer of an insert that wrote the row `id`. */
export const INSERTED = (id: string): QueryBuilderAnswers => ({ execute: { raw: [{ id }] } })

/** The answer of an insert that was ignored because the key was taken. */
export const IGNORED: QueryBuilderAnswers = { execute: { raw: [] } }

/** The answer of the update that counted a repeat on the row `id`. */
export const BUMPED = (id: string): QueryBuilderAnswers => ({ execute: { raw: [{ id }] } })

/** The answer of the update that found no row to count a repeat on. */
export const NOT_BUMPED: QueryBuilderAnswers = { execute: { raw: [] } }

/** A lead input of the zalo channel; a spec states only the fields it varies. */
export const inboundInput = (overrides: Partial<InboundInputOf> = {}): InboundInputOf => ({
    workspaceId: "ws-1",
    channel: "zalo",
    kind: "lead",
    senderName: "Mai",
    senderContact: null,
    body: "Haircut",
    externalRef: null,
    eventId: "evt-1",
    ...overrides,
})

/** One stored inbound event; a spec states only the fields it varies. */
export const eventEntity: (overrides?: Partial<InboundEventEntity>) => InboundEventEntity = builder<InboundEventEntity>(
    {
        id: "event-1",
        workspaceId: "ws-1",
        channel: "zalo",
        kind: "lead",
        senderName: "Mai",
        senderContact: null,
        body: "Haircut",
        amountVnd: null,
        externalRef: null,
        dedupeKey: "zalo:lead:evt-1",
        duplicateCount: 0,
        lastDuplicateAt: null,
        eventId: "evt-1",
        leadId: null,
        status: "received",
        customerKey: null,
        source: {},
        createdAt: new Date("2026-10-13T10:00:00.000Z"),
        updatedAt: new Date("2026-10-13T10:00:00.000Z"),
    },
)

/** A bank credit as `recordBankPayment` receives it, recorded through a manager. */
export interface BankPaymentEventOf {
    /** The manager the credit is recorded through. */
    readonly manager: MockEntityManager
    /** The workspace. */
    readonly workspaceId: string
    /** The sender, when named. */
    readonly sender: string | null
    /** The text of the credit. */
    readonly body: string
    /** The amount in dong. */
    readonly amountVnd: number
    /** The reference the payer wrote. */
    readonly externalRef: string
    /** The provider's own reference. */
    readonly providerRef: string
}

/** A bank credit as `recordBankPayment` receives it, recorded through `manager`. */
export const bankPaymentEvent = (manager: MockEntityManager): BankPaymentEventOf => ({
    manager,
    workspaceId: "ws-1",
    sender: null,
    body: "ACB credit",
    amountVnd: 150000,
    externalRef: "NIVO8F3K2",
    providerRef: " casso:7 ",
})
