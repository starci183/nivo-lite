import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager, MockOf } from "@starci/jest-preset"
import type { AgentCard, AgentDirectoryService } from "@modules/domain/agents"
import type { InvoicesLedgerService } from "@modules/domain/invoices"
import type { LeadReadService } from "@modules/domain/leads"
import type { InstallationRecord, InstallationRecordsService } from "@modules/domain/module-installations"
import type { OrdersLabelReadService } from "@modules/domain/orders"
import type { WorkItemsChainReadService } from "@modules/domain/work-items"
import { AGENT_ID } from "./command-planner.builder"

/** The named reads a spec stages, each a pair of the read name and the rows it answers. */
export type Queries = ReadonlyArray<readonly [string, unknown]>

/** The reads of the planner, named. Each one is a read of an owner's service, except the resolver, which is a database function. */
export const FIND_SENDER_AGENT = "sender agent"
export const FIND_PARENT_POSITION = "parent position"
export const FIND_CHAIN_TOP = "chain top"
export const CHAIN_REPEATS_COMMAND = "chain repeats"
export const FIND_GIVEN_INSTALLATION = "given installation"
export const FIND_SUBJECT_LABEL = "subject label"
/** The statement `callDbFunction` sends for the resolver. */
export const RESOLVE_INSTALLATION = 'SELECT * FROM "public"."resolve_installation"($1, $2, $3, $4, $5)'
/** Stands for a lookup that fails: every read of a subject label rejects. */
export const UNREADABLE = "SELECT 1"

/** The rows staged for the named read; an unstaged read, or a staged value that is not a list of rows, answers none. */
export const rowsAt = (queries: Queries, key: string): ReadonlyArray<Record<string, unknown>> => {
    const rows: unknown = queries.find(([name]) => name === key)?.[1]
    return Array.isArray(rows)
        ? rows.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
        : []
}

const textAt = (row: Record<string, unknown> | undefined, key: string): string | null => {
    const value = row?.[key]
    return typeof value === "string" ? value : null
}

const numberAt = (row: Record<string, unknown> | undefined, key: string): number | null => {
    const value = row?.[key]
    return typeof value === "number" ? value : null
}

/** The owner services a spec binds as `mock<...>()` doubles and has {@link answer} wire with the reads. */
export interface Owners {
    readonly agents: MockOf<AgentDirectoryService>
    readonly installations: MockOf<InstallationRecordsService>
    readonly chains: MockOf<WorkItemsChainReadService>
    readonly orders: MockOf<OrdersLabelReadService>
    readonly leads: MockOf<LeadReadService>
    readonly invoices: MockOf<InvoicesLedgerService>
}

/** The manager a spec runs against and the reads its owner services answer. */
export interface Served {
    readonly em: MockEntityManager
    readonly queries: Queries
}

const named = (name: string | null): InstallationRecord | null =>
    name === null ? null : mock<InstallationRecord>({ name })

/** The agent directory and the installation records answering the named reads. */
const senders = (queries: Queries, { agents, installations }: Pick<Owners, "agents" | "installations">): void => {
    const [agent] = rowsAt(queries, FIND_SENDER_AGENT)
    const [given] = rowsAt(queries, FIND_GIVEN_INSTALLATION)
    const [resolved] = rowsAt(queries, RESOLVE_INSTALLATION)
    const card: AgentCard = {
        id: AGENT_ID,
        name: textAt(agent, "name") ?? "",
        module: textAt(agent, "module") ?? "",
        canTagAgentIds: [],
    }
    agents.find.mockResolvedValue(agent === undefined ? null : card)
    installations.ofAgent.mockResolvedValue(named(textAt(agent, "installation_name")))
    installations.find.mockResolvedValue(
        given === undefined ? null : mock<InstallationRecord>({ ...given, moduleKey: "chatbot" }),
    )
    installations.findById.mockResolvedValue(named(textAt(resolved, "name")))
}

/** The work item chain reads answering the named reads. */
const chainsOf = (queries: Queries, chains: Owners["chains"]): void => {
    const [parent] = rowsAt(queries, FIND_PARENT_POSITION)
    const [top] = rowsAt(queries, FIND_CHAIN_TOP)
    const spot: Awaited<ReturnType<WorkItemsChainReadService["spotOf"]>> =
        parent === undefined
            ? null
            : {
                  id: textAt(parent, "id") ?? "",
                  chainId: textAt(parent, "chain_id"),
                  depth: numberAt(parent, "depth") ?? 0,
              }
    chains.spotOf.mockResolvedValue(spot)
    chains.topDepth.mockResolvedValue(numberAt(top, "depth"))
    chains.repeats.mockResolvedValue(rowsAt(queries, CHAIN_REPEATS_COMMAND).some((row) => row.repeats === true))
}

/** The readers of the readable label of a subject, answering the named label (or all rejecting when the lookup is unreadable). */
const labelsOf = (
    queries: Queries,
    { orders, leads, invoices }: Pick<Owners, "orders" | "leads" | "invoices">,
): void => {
    const text = textAt(rowsAt(queries, FIND_SUBJECT_LABEL)[0], "label")
    const failing = queries.some(([key]) => key === UNREADABLE)
    const read = <T>(value: T): Promise<T> =>
        failing ? Promise.reject(new RangeError("lookup failed")) : Promise.resolve(value)
    const card = { id: "lead-1", contactName: text ?? "", company: "", channel: "", stage: "new", email: null }
    const invoice = { id: "invoice-1", invoiceNo: text ?? "", amountVnd: 0, leadId: null, paidAt: null }
    orders.numbersOf.mockImplementation(() => read(text === null ? [] : [{ id: "order-1", orderNo: text }]))
    leads.cardsOf.mockImplementation(() => read(text === null ? [] : [card]))
    invoices.receiptInvoice.mockImplementation(() => read(text === null ? null : invoice))
}

/** Makes the owner services answer the named reads with their rows; with no reads they answer nothing. */
export const answer = (queries: Queries, owners: Owners): void => {
    senders(queries, owners)
    chainsOf(queries, owners.chains)
    labelsOf(queries, owners)
}

/** A manager that answers the named reads with their rows, and the reads the owner services are to answer. */
export const serve = (queries: Queries = []): Served => {
    const resolved = rowsAt(queries, RESOLVE_INSTALLATION)
    const em = queries.some(([key]) => key === RESOLVE_INSTALLATION)
        ? mockEntityManager({
              query: [RESOLVE_INSTALLATION, resolved.map(({ installation_id, via }) => ({ installation_id, via }))],
          })
        : mockEntityManager()
    return { em, queries }
}
