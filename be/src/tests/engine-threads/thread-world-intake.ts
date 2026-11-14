import { mock, mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { AccountDataReadService, AccountDataTypesService } from "@modules/domain/account-data"
import type { AccountDataInput, AccountDataTypeDef, StoredRow } from "@modules/domain/account-data"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { ChannelSendExecutorService } from "@modules/domain/chat-node-ports"
import { ConnectionBindingsReadService, type ConnectionRecord } from "@modules/domain/connections"
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import { HeldLinesService } from "@modules/domain/conversations"
import { ChannelDeliveriesService, CustomerMessagesService, CustomerRoutesService } from "@modules/domain/customer-routes"
import { AgentWakeService } from "@modules/domain/agent-work"
import { burstFor } from "@modules/domain/agent-work/agent-work.policy"
import type { AgentBurstWindow } from "@modules/domain/agent-work/agent-work.port"
import type { AgentWake, PendingScopeWake } from "@modules/domain/agent-work"
import { AgentWorkflowTriggerReceiversService } from "@modules/domain/agent-graphs/agent-workflow-trigger-receivers.service"
import type { GraphNodeRegistryService, NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { ProviderTriggersService, triggerDeclarations } from "@modules/domain/provider-triggers"
import type { KeptFile } from "@modules/domain/provider-triggers/trigger-delivery.policy"
import type { AgentAccountsService } from "@modules/domain/tools"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import { WORKFLOW_CALL_TRIGGER } from "@modules/domain/agent-schedules/workflow-call.trigger"
import { bankTransactionTriggerFor } from "@modules/domain/bank-feed-inbox"
import { cassoTransaction, payosTransaction, sepayTransaction } from "@modules/domain/bank-feed-inbox/bank-feed.data-types"
import { WEBSITE_FORM_TRIGGER } from "@modules/domain/inbox-leads/website-form.trigger"
import { WebsiteLeadWakeService } from "@modules/domain/inbox-leads/website-lead-wake.service"
import { ZALO_MESSAGE_TRIGGER } from "@modules/domain/zalo-provider/zalo-message.trigger"
import { zaloEventRowsOf } from "@modules/domain/zalo-inbox/zalo.normalise.policy"
import { zaloEvent, zaloMessage } from "@modules/domain/zalo-inbox/zalo.data-types"
import type { Logger } from "@modules/platform/logging"
import { WS, WorldError } from "./thread-world-records"
import type { ChatWorld } from "./thread-world-chat"
import type { Account, Line, Outside } from "./thread-world-outside"
import type { ThreadDb } from "./thread-world-process"

// THE CUSTOMER'S ROAD INTO THE WORLD (the one event pipeline of 2026-11-14, lane concept `triggers` rule 13). A customer's message enters as
// the Zalo adapter's entry takes it: the body Zalo posted is KEPT ONCE as a `zalo_oa.event` row of the account (its unique key is the
// dedupe: a repeat goes no further), the provider's own PURE declaration (`ZALO_MESSAGE_TRIGGER.translate`) turns the stored row into the
// canonical event, and the REAL `ProviderTriggersService.deliver` does the rest: it meets the contact (the real `ContactsService`), ensures
// the route (the real `CustomerRoutesService`), asks the REAL receivers (the account's attachments, and the real
// `AgentWorkflowRunsService.takerOfEvent` over the world's seeded workflows) which registration takes it, and writes ONE wake per agent
// and event through the wake door. The only doubles are the account store (rows in memory), the wake table (a list: `pendingOfScope` and
// `claimQueued` answer the run queue the way the table does), the switch store and the transaction. The release door is the REAL
// `HeldLinesService`. The send is the REAL `ChannelSendExecutorService` over the real ledger and routes; only the provider's push is a
// double that records the line it delivered.

/** The state of a wake in the world's wake table. */
export type HeardState = "pending" | "held" | "begun" | "queued"

/** A wake the delivery wrote, with the id the table gave it. */
export interface HeardWake extends AgentWake {
    /** The wake id. */
    readonly id: string
    /** When the table took it. */
    readonly createdAt: Date
    /** `pending` until a run began on it; `held` once its event waits behind a run (`waiting:<run>`, rule Q-1) or out of hours; `begun` once one did; `queued` once a step of a run took it into its queue snapshot. */
    state: HeardState
    /** Why it closed (`queued:<run>` when a run's queue took it). */
    reason?: string
    /**
     * The window the wake door stamped on it when it was written (`agent_wakes.burst_window_ms` / `burst_max_ms`): the settle time the
     * registration that took the event asks, resolved by the REAL `burstFor`; null when the registration asks none.
     */
    readonly burst: AgentBurstWindow | null
}

/** What the world builds once per database over its chat stores. */
export interface ChatServices {
    readonly contacts: ContactsService
    readonly routes: CustomerRoutesService
    readonly deliveries: ChannelDeliveriesService
    /** The engine's conversation with the customer (R26): the lines the person said and the ones said to them, one thread. */
    readonly messages: CustomerMessagesService
    readonly raw: AccountDataReadService
    readonly types: AccountDataTypesService
    readonly bindings: ConnectionBindingsReadService
    /** The REAL one delivery function, over the real contacts, routes and receivers and the world's wake table. */
    readonly triggers: ProviderTriggersService
    /** The REAL release door (a person hands the conversation back). */
    readonly held: HeldLinesService
}

/** The bank feeds' REAL transaction row types (one per feed, purpose `bank.transaction`, keyed by the provider's id of the move). */
const BANK_TRANSACTION_TYPES: ReadonlyArray<AccountDataTypeDef> = [sepayTransaction, cassoTransaction, payosTransaction]

/** The raw rows of the world's entries: the Zalo event and message rows, and the bank feeds' movements. */
const ROW_TYPES: ReadonlyArray<AccountDataTypeDef> = [zaloEvent, zaloMessage, ...BANK_TRANSACTION_TYPES]

/** What the world reads of a database to build the chat road (a `ThreadDb` is one). */
export type ChatSource = Pick<ThreadDb, "clock" | "rights" | "chat" | "workflows">

/** The key of a row: the declared key members' values, joined as the store joins them. */
const keyOf = (def: AccountDataTypeDef, value: Readonly<Record<string, unknown>>): string =>
    def.key.map((member) => String(value[member] ?? "")).join(":")

/** The instant a row happened: its declared `at` member, else the given default. */
const happenedOf = (def: AccountDataTypeDef, value: Readonly<Record<string, unknown>>, fallback: Date): Date => {
    const stamp = def.occurredAt === undefined ? undefined : value[def.occurredAt]
    return typeof stamp === "string" ? new Date(stamp) : fallback
}

/** The connection record a connected account of the world stands for (the shape `ConnectionBindingsReadService.recordOf` answers). */
export const connectionRecordOf = (workspaceId: string, account: Pick<Account, "id" | "provider">): ConnectionRecord => ({
    id: account.id,
    workspaceId,
    provider: account.provider,
    name: account.id,
    meta: {},
    status: "connected",
    lastError: null,
    environment: "live",
    sandbox: false,
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-10T10:00:00.000Z",
})

/** The wakes still waiting in a lock scope of an agent, oldest first (what the table's `pending` rows are). */
const pendingOf = (chat: ChatWorld, agentId: string, scopeKey: string): ReadonlyArray<HeardWake> =>
    chat.wakes.filter((one) => one.state === "pending" && one.agentId === agentId && one.scopeKey === scopeKey)

/**
 * The wake door's two reads of the run queue, over the world's wake table, as the table answers them: the pending wakes of one lock scope
 * (`pendingOfScope`) and the closing of those a step took (`claimQueued`: each still pending or held becomes `queued:<run>`, one already closed is
 * left as it is). The process's wake double answers them from here.
 */
export const wakeQueueOf = (chat: ChatWorld): Pick<AgentWakeService, "pendingOfScope" | "claimQueued" | "reoffer" | "dropWaiting" | "releaseWaiting" | "waitingCountOf" | "heldBehind" | "runsHeldBehind"> => ({
    // The run a subject's events waited behind has ended: every wake held `waiting:<run>` is pending again, in the order it came.
    releaseWaiting: (_manager: unknown, _workspaceId: string, runId: string): Promise<number> => {
        let released = 0
        for (const wake of chat.wakes) {
            if (wake.reason !== `waiting:${runId}`) continue
            wake.state = "pending"
            delete wake.reason
            released += 1
        }
        return Promise.resolve(released)
    },
    waitingCountOf: (_manager: unknown, _workspaceId: string, runId: string): Promise<number> =>
        Promise.resolve(chat.wakes.filter((wake) => wake.reason === `waiting:${runId}`).length),
    // The wakes still held behind a run (`waiting:<run>`), oldest first: what a step of that run that runs again after a decision takes.
    heldBehind: (_manager: unknown, _workspaceId: string, runId: string, limit: number): Promise<ReadonlyArray<PendingScopeWake>> =>
        Promise.resolve(
            chat.wakes
                .filter((wake) => wake.state === "held" && wake.reason === `waiting:${runId}`)
                .slice(0, limit)
                .map((one) => ({ id: one.id, context: one.context, createdAt: one.createdAt })),
        ),
    // The runs wakes are held behind (the sweep's backstop reads them).
    runsHeldBehind: (_manager: unknown, _workspaceId: string, limit: number): Promise<ReadonlyArray<string>> =>
        Promise.resolve(
            [
                ...new Set(
                    chat.wakes.flatMap((wake) =>
                        wake.state === "held" && wake.reason?.startsWith("waiting:") === true ? [wake.reason.slice("waiting:".length)] : [],
                    ),
                ),
            ].slice(0, limit),
        ),
    // The wakes held behind a run that ended because its subject was erased are dropped with that reason (none are held in the world's table).
    dropWaiting: (_manager: unknown, _workspaceId: string, runId: string, reason: string): Promise<number> => {
        let dropped = 0
        for (const wake of chat.wakes) {
            if (wake.reason !== `waiting:${runId}`) continue
            wake.state = "begun"
            wake.reason = reason
            dropped += 1
        }
        return Promise.resolve(dropped)
    },
    pendingOfScope: (
        _manager: unknown,
        _workspaceId: string,
        agentId: string,
        scopeKey: string,
        limit: number,
    ): Promise<ReadonlyArray<PendingScopeWake>> =>
        Promise.resolve(
            pendingOf(chat, agentId, scopeKey)
                .slice(0, limit)
                .map((one) => ({ id: one.id, context: one.context, createdAt: one.createdAt })),
        ),
    // A run HANDS BACK the event its wait took: every wake of that event that ended because a wait took it is pending again and names the
    // run among those that handed it back (the real `AgentWakeService.reoffer`, over the world's wake table).
    reoffer: (
        _manager: unknown,
        _workspaceId: string,
        event: { readonly source: string; readonly eventKey: string; readonly reason: string },
        runId: string,
    ): Promise<number> => {
        let reoffered = 0
        for (const wake of chat.wakes) {
            if (wake.source !== event.source || wake.eventKey !== event.eventKey || wake.state !== "begun" || wake.reason !== event.reason) continue
            const handers: ReadonlyArray<string> = JSON.parse(String(wake.context.handedBackJson ?? "[]"))
            if (handers.includes(runId)) continue
            Object.assign(wake, { context: { ...wake.context, handedBackJson: JSON.stringify([...handers, runId]) } })
            wake.state = "pending"
            delete wake.reason
            reoffered += 1
        }
        return Promise.resolve(reoffered)
    },
    claimQueued: (_manager: unknown, _workspaceId: string, wakeIds: ReadonlyArray<string>, runId: string): Promise<number> => {
        let closed = 0
        for (const wake of chat.wakes) {
            if (!wakeIds.includes(wake.id) || (wake.state !== "pending" && wake.state !== "held")) continue
            wake.state = "queued"
            wake.reason = `queued:${runId}`
            closed += 1
        }
        return Promise.resolve(closed)
    },
})

/**
 * The instant the world's wake table stamps its first wake with (each later one a millisecond on): the table's own clock, never the world's
 * ticking clock, whose every read is one second of the traces the baselines record.
 */
const WAKE_EPOCH = Date.parse("2026-11-10T10:00:00.000Z")

/** An entity manager whose `transaction` runs its work at once on a stand-in transaction (the entries open one around their delivery). */
export const transactionalManager = (): EntityManager => {
    const inTransaction = (run: (tx: EntityManager) => Promise<unknown>): Promise<unknown> => run(mockEntityManager())
    return mock<EntityManager>({ transaction: inTransaction as EntityManager["transaction"] })
}

/** The services of the chat road over a database, built once. */
const cache = new WeakMap<ChatWorld, ChatServices>()

/** The chat services of a database: the real ones over its stores. */
export const chatServicesOf = (source: ChatSource): ChatServices => {
    const { chat, clock, rights, workflows } = source
    const known = cache.get(chat)
    if (known !== undefined) return known
    const contacts = new ContactsService(chat.contacts, clock)
    const routes = new CustomerRoutesService(chat.routes, contacts)
    const deliveries = new ChannelDeliveriesService(chat.ledger, contacts)
    const messages = new CustomerMessagesService(chat.lines, contacts, clock)
    const storedOf = (row: (typeof chat.raw)[number]): StoredRow => ({
        id: row.id,
        type: row.type,
        typeVersion: 1,
        key: row.key,
        value: row.value,
        occurredAt: row.occurredAt,
        processedAt: null,
    })
    const raw = mock<AccountDataReadService>({
        get: (connectionId: string, type: string, key: string) => {
            const row = chat.raw.find((one) => one.connectionId === connectionId && one.type === type && one.key === key)
            return Promise.resolve(row === undefined ? null : storedOf(row))
        },
        byId: (type: string, id: string) => {
            const row = chat.raw.find((one) => one.type === type && one.id === id)
            return Promise.resolve(
                row === undefined ? null : { ...storedOf(row), connectionId: row.connectionId, createdAt: row.occurredAt.toISOString() },
            )
        },
    })
    const types = mock<AccountDataTypesService>({ all: () => ROW_TYPES })
    const bindings = mock<ConnectionBindingsReadService>({
        recordOf: (workspaceId: string, id: string) => {
            const account = rights.accounts.find((one) => one.id === id)
            return Promise.resolve(account === undefined ? null : connectionRecordOf(workspaceId, account))
        },
        ofProvider: () => Promise.resolve([]),
    })
    // The wake door as the table makes it (`AgentWakeService.write`): insert-or-nothing on (agent, source, event key); the settle time the
    // registration asked is the wake's window, resolved by the REAL `burstFor`.
    const wakes = mock<AgentWakeService>({
        ...wakeQueueOf(chat),
        write: (_tx: unknown, wake: AgentWake) => {
            if (chat.wakes.some((one) => one.agentId === wake.agentId && one.source === wake.source && one.eventKey === wake.eventKey))
                return Promise.resolve(null)
            const scopeKey = wake.scopeKey ?? "agent"
            const burst = wake.settle === undefined ? null : burstFor(wake.settle)
            const id = `heard-${chat.wakes.length + 1}`
            chat.wakes.push({ ...structuredClone(wake), scopeKey, id, createdAt: new Date(WAKE_EPOCH + chat.wakes.length), state: "pending", burst })
            return Promise.resolve(id)
        },
    })
    const attachments = mock<AccountAttachmentsService>({ listOfWorkspace: () => Promise.resolve(rights.attachments) })
    const receivers = new AgentWorkflowTriggerReceiversService(attachments, workflows.service)
    triggerDeclarations.register(ZALO_MESSAGE_TRIGGER)
    const logger = mock<Logger>()
    type Parameters3 = ConstructorParameters<typeof ProviderTriggersService>
    const triggers = new ProviderTriggersService(
        mockEntityManager(),
        clock,
        logger,
        // A customer channel has no switch; a bank feed's switch is on (the owner switched it on) and counts nothing.
        mock<Parameters3[3]>({
            find: (_tx: unknown, connectionId: string, name: string) =>
                Promise.resolve(mock<NonNullable<Awaited<ReturnType<Parameters3[3]["find"]>>>>({ id: `switch:${connectionId}:${name}`, workspaceId: WS, enabled: true, enabledAt: null })),
            markFired: () => Promise.resolve(),
        }),
        bindings,
        receivers,
        null,
        contacts,
        routes,
        wakes,
        messages,
    )
    const held = new HeldLinesService(transactionalManager(), clock, logger, routes, triggers)
    const built: ChatServices = { contacts, routes, deliveries, messages, raw, types, bindings, triggers, held }
    cache.set(chat, built)
    return built
}

/** One line a customer says, as the Zalo adapter's entry gets it. */
export interface HeardLine {
    /** The connection (Zalo account) it came in on. */
    readonly connectionId: string
    /** The customer's id on Zalo. */
    readonly userId: string
    /** Zalo's own id of the message (`msg_id`): the raw row's key and the event's id. */
    readonly msgId: string
    /** The words. */
    readonly text: string
    /** When the customer sent it. */
    readonly at: Date
    /** The name Zalo shows for them: only a body the poll made of a listed message carries one (the webhook names none). */
    readonly visitor?: string | undefined
    /** The pictures the entry kept in the shop's store for it (as `CustomerFilesService.keep` answers). */
    readonly files?: ReadonlyArray<KeptFile> | undefined
}

/** The body Zalo's webhook posts for a customer's text. */
const bodyOf = (line: HeardLine): Buffer =>
    Buffer.from(
        JSON.stringify({
            event_name: "user_send_text",
            sender: { id: line.userId, ...(line.visitor === undefined ? {} : { display_name: line.visitor }) },
            message: { msg_id: line.msgId, text: line.text },
            timestamp: String(line.at.getTime()),
        }),
        "utf8",
    )

/**
 * The wakes the delivery wrote for one line: the new ones only. The entry's steps in order: keep the body once as the account's event row
 * (a repeat keeps nothing and goes no further), run the provider's pure translate on the STORED row, hand the event (with the row's id and
 * the kept pictures) to the real `deliver`.
 */
export const heard = async (source: ChatSource, line: HeardLine): Promise<ReadonlyArray<HeardWake>> => {
    const { chat, clock } = source
    const before = chat.wakes.length
    const [input]: ReadonlyArray<AccountDataInput> = zaloEventRowsOf(bodyOf(line))
    if (input === undefined) throw new WorldError({ code: "WORLD_ACCOUNT_TYPE_UNKNOWN", params: { name: zaloEvent.name } })
    const value = Object.fromEntries(Object.entries(input.value))
    const key = keyOf(zaloEvent, value)
    if (chat.raw.some((one) => one.connectionId === line.connectionId && one.type === zaloEvent.name && one.key === key)) return []
    const id = `row-${chat.raw.length + 1}`
    chat.raw.push({ id, connectionId: line.connectionId, type: zaloEvent.name, key, value, occurredAt: happenedOf(zaloEvent, value, clock.now()) })
    const row = ZALO_MESSAGE_TRIGGER.raw.safeParse(value)
    const event = row.success ? ZALO_MESSAGE_TRIGGER.translate(row.data, { connectionId: line.connectionId }) : null
    if (event === null) return []
    await chatServicesOf(source).triggers.deliver(
        {
            workspaceId: WS,
            declaration: ZALO_MESSAGE_TRIGGER,
            connectionId: line.connectionId,
            agentId: null,
            events: [
                {
                    event,
                    raw: { type: zaloEvent.name, id },
                    ...(line.files === undefined || line.files.length === 0 ? {} : { files: line.files }),
                    ...(event.data.at === null ? {} : { occurredAt: event.data.at }),
                },
            ],
        },
        mockEntityManager(),
    )
    return chat.wakes.slice(before)
}

/**
 * THE WORLD'S MODEL of the drain, one lock scope at a time: the OLDEST pending wake begins the next run (the lease keeps a second run of
 * the scope off while one is in flight). A wake a step took into its queue snapshot (`queued:<run>`) is closed and begins nothing; one that
 * arrived and was not taken is the next run of the key. Answers the wake that begins the next run among `among`, or undefined.
 */
export const nextTurnOf = (among: ReadonlyArray<HeardWake>): HeardWake | undefined => among.find((wake) => wake.state === "pending")

/** The double of the provider's push: every line it delivers is a `Line` of the world, tagged as the ledger says who told it. */
const channelOf = (outside: Pick<Outside, "clock" | "lines" | "chat">): ChannelDeliveryService =>
    mock<ChannelDeliveryService>({
        deliverToPerson: async (request: { readonly workspaceId: string; readonly routeId: string; readonly sendKey: string; readonly text: string }) => {
            if (outside.chat.channelOutcome === "ambiguous") return { delivered: false, failure: null, outcome: "ambiguous" as const }
            const claimed = await outside.chat.ledger.byKey(request.workspaceId, request.sendKey)
            const line: Line = {
                conversationId: request.routeId,
                text: request.text,
                channelRef: `line:${request.sendKey}`,
                sentAt: outside.clock.now().toISOString(),
                agentId: claimed?.agentId ?? "",
            }
            outside.lines.push(line)
            return { delivered: true, failure: null, outcome: "acknowledged" as const }
        },
    })

/** The send executor of the world: the REAL one over the real routes, contacts and ledger, and the real rights judge. */
export const sendExecutorOf = (
    outside: ChatSource & Pick<Outside, "lines">,
    accounts: AgentAccountsService,
    registry: GraphNodeRegistryService,
    logger: Logger,
): NodeEffectExecutor => {
    const services = chatServicesOf(outside)
    return new ChannelSendExecutorService(
        outside.clock,
        logger,
        services.contacts,
        services.routes,
        services.deliveries,
        channelOf(outside),
        registry,
        accounts,
        undefined,
        undefined,
        // `lines`: the engine's conversation store (R26): the Zalo reply window reads the person's last heard line.
        services.messages,
    )
}

/** An act of the executor, as the world's registry runs it (a fact: a message with its receipt, or a refusal). */
export type SendExecution = (turn: NodeTurn, payload: EffectPayload, call: EffectCall) => Promise<SubjectRef>

/** The channel and the person a world meets by default. */
export interface Customer {
    readonly connectionId: string
    readonly userId: string
    readonly name: string
    readonly channel: string
    /** The route id the person's route has (a route born before the spec: the id every engine row of the world names). */
    readonly routeId: string
}

/**
 * Meets the world's default customer once: the contact the channel vouches for, and their route on the entrance, adopted under the id
 * the world's engine rows name (`CONV`). Idempotent. Answers the contact id.
 */
export const seededCustomer = async (outside: ChatSource, customer: Customer, expectedContact: string): Promise<string> => {
    const { chat } = outside
    const services = chatServicesOf(outside)
    const contactId = await services.contacts.meetChannel(WS, {
        channel: customer.channel,
        account: customer.connectionId,
        userId: customer.userId,
        name: customer.name,
    })
    if (!chat.seeded) {
        if (contactId !== expectedContact)
            throw new WorldError({ code: "WORLD_CONTACT_ID_MOVED", params: { contactId, expectedContact } })
        await services.routes.ensure(WS, {
            contactId,
            channel: customer.channel,
            accountId: customer.connectionId,
            adoptId: customer.routeId,
        })
        chat.seeded = true
    }
    return contactId
}

/** A hand-off to a workflow of an agent, as a run's `callWorkflow` makes it: the caller's params are the event's `data`, flat; the pin names the callee. */
export interface CalledWorkflow {
    /** The agent that runs the callee. */
    readonly agentId: string
    /** The callee's workflow key (the pin). */
    readonly workflow: string
    /** What the caller mapped: the callee's input, exactly. */
    readonly params: Readonly<Record<string, unknown>>
    /** The caller's once-key for this call. */
    readonly key: string
    /** The person the call is about, and the route they are on. */
    readonly contactId: string
    readonly routeId: string
    /** The calling agent and run, as `core.call-workflow`'s effect hands them to `deliver` (the call guards read them); none when absent. */
    readonly caller?: { readonly agentId: string; readonly runId: string }
}

/**
 * The hand-off as the REAL `deliver` takes it (an engine source: `workflow.called`, its one agent named, no account): the pure translate of the
 * declaration, the pin on the wake, the person and route beside the event. Answers the wakes written (none for a key delivered before).
 */
export const calledWorkflow = async (source: ChatSource, call: CalledWorkflow): Promise<ReadonlyArray<HeardWake>> => {
    const { chat } = source
    const before = chat.wakes.length
    triggerDeclarations.register(WORKFLOW_CALL_TRIGGER)
    const event = WORKFLOW_CALL_TRIGGER.translate({ key: call.key, params: call.params }, { connectionId: null })
    if (event === null) return []
    await chatServicesOf(source).triggers.deliver(
        {
            workspaceId: WS,
            declaration: WORKFLOW_CALL_TRIGGER,
            connectionId: null,
            agentId: call.agentId,
            events: [
                {
                    event,
                    contactId: call.contactId,
                    routeId: call.routeId,
                    pin: { workflow: call.workflow, version: "latest" },
                    ...(call.caller === undefined ? {} : { caller: call.caller }),
                },
            ],
        },
        mockEntityManager(),
    )
    return chat.wakes.slice(before)
}

/** One movement a bank feed reports (SePay, Casso, payOS), as the feed's intake keeps it. */
export interface HeardCredit {
    /** The bank feed's account (connection) it came on. */
    readonly connectionId: string
    /** The feed's provider. */
    readonly provider: string
    /** The provider's id of the movement. */
    readonly transactionId: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The transfer content the payer wrote. */
    readonly content: string
    /** Money in (`credit`) or out (`debit`). */
    readonly direction?: "credit" | "debit"
    /** When the bank booked it. */
    readonly at: string
}

/**
 * A bank movement enters as the feed's entry takes it: the `<provider>.transaction` row is kept ONCE on the account, the declaration's pure
 * translate turns the stored row into the event, the REAL `deliver` asks every agent attached to the account (a registration, or a `wait` that
 * lists the verb) and writes the wakes. Answers the wakes written (none for a movement the account already kept).
 */
export const heardCredit = async (source: ChatSource, credit: HeardCredit): Promise<ReadonlyArray<HeardWake>> => {
    const { chat, clock } = source
    const declaration = bankTransactionTriggerFor(credit.provider)
    if (declaration === null) throw new WorldError({ code: "WORLD_ACCOUNT_TYPE_UNKNOWN", params: { name: credit.provider } })
    triggerDeclarations.register(declaration)
    const before = chat.wakes.length
    // The feed's REAL transaction row type and its key rule (ruling R51 item 2): the row is kept under the provider's id of the move (its
    // key), and the database gives it an id of its own (`row-<n>`); the two are never the same. (This world once kept it under an invented
    // type name, so no real reader of the account store could find it and the credit read was a double keyed like the event.)
    const def = BANK_TRANSACTION_TYPES.find((one) => one.provider === credit.provider)
    if (def === undefined) throw new WorldError({ code: "WORLD_ACCOUNT_TYPE_UNKNOWN", params: { name: credit.provider } })
    const type = def.name
    if (chat.raw.some((one) => one.connectionId === credit.connectionId && one.type === type && one.key === credit.transactionId)) return []
    const value = {
        transactionId: credit.transactionId,
        amount: credit.amountVnd,
        direction: credit.direction ?? "credit",
        content: credit.content,
        at: credit.at,
        source: credit.provider,
    }
    const id = `row-${chat.raw.length + 1}`
    chat.raw.push({ id, connectionId: credit.connectionId, type, key: keyOf(def, value), value, occurredAt: new Date(credit.at) })
    void clock
    const row = declaration.raw.safeParse(value)
    const event = row.success ? declaration.translate(row.data, { connectionId: credit.connectionId }) : null
    if (event === null) return []
    await chatServicesOf(source).triggers.deliver(
        {
            workspaceId: WS,
            declaration,
            connectionId: credit.connectionId,
            agentId: null,
            events: [{ event, raw: { type, id }, occurredAt: credit.at }],
        },
        mockEntityManager(),
    )
    return chat.wakes.slice(before)
}

/** What a visitor gives a hosted form (the entry has already met the contact and linked the typed claims). */
export interface WebsiteForm {
    readonly agentId: string
    readonly contactId: string
    readonly siteId: string
    readonly inboundEventId: string
    readonly visitorKey: string
    readonly name: string | null
    readonly phone: string | null
    readonly request: string
}

/** An accepted website form enters through the form's REAL entry service (`WebsiteLeadWakeService`): the declaration's translate, `deliver`. Answers the wakes written. */
export const websiteSubmitted = async (source: ChatSource, form: WebsiteForm): Promise<ReadonlyArray<HeardWake>> => {
    const { chat } = source
    const before = chat.wakes.length
    triggerDeclarations.register(WEBSITE_FORM_TRIGGER)
    // The entry met the visitor before it delivered: the site's own id of them is a channel identity of the contact, so the engine finds them.
    await chatServicesOf(source).contacts.linkIdentity(
        WS,
        form.contactId,
        { kind: "channel", provider: "website", account: form.siteId, value: form.visitorKey, proof: "channel" },
        { kind: "channel" },
    )
    const entry = new WebsiteLeadWakeService(transactionalManager(), mock<Logger>(), chatServicesOf(source).triggers)
    await entry.wake(WS, form.agentId, {
        contactId: form.contactId,
        siteId: form.siteId,
        inboundEventId: form.inboundEventId,
        visitorKey: form.visitorKey,
        name: form.name,
        phone: form.phone,
        email: null,
        request: form.request,
        source: {},
    })
    return chat.wakes.slice(before)
}
