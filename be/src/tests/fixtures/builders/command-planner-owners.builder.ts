import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager, MockOf } from "@starci/jest-preset"
import type { AgentDirectoryService } from "@modules/domain/agents"
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
export const RESOLVE_INSTALLATION = "SELECT * FROM public.resolve_installation($1, $2, $3, $4, $5)"
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

/** The manager a spec runs against and the owner services it reads through, with the reads they answer. */
export interface Served {
    readonly em: MockEntityManager
    readonly agents: MockOf<AgentDirectoryService>
    readonly installations: MockOf<InstallationRecordsService>
    readonly chains: MockOf<WorkItemsChainReadService>
    readonly orders: MockOf<OrdersLabelReadService>
    readonly leads: MockOf<LeadReadService>
    readonly invoices: MockOf<InvoicesLedgerService>
}

const named = (name: string | null): InstallationRecord | null =>
    name === null ? null : mock<InstallationRecord>({ name })

/** The agent directory and the installation records answering the named reads. */
const senders = (queries: Queries): Pick<Served, "agents" | "installations"> => {
    const [agent] = rowsAt(queries, FIND_SENDER_AGENT)
    const [given] = rowsAt(queries, FIND_GIVEN_INSTALLATION)
    const [resolved] = rowsAt(queries, RESOLVE_INSTALLATION)
    const card = { id: AGENT_ID, name: textAt(agent, "name"), module: textAt(agent, "module"), canTagAgentIds: [] }
    const agents = mock<AgentDirectoryService>()
    agents.find.mockResolvedValue(agent === undefined ? null : card)
    const installations = mock<InstallationRecordsService>()
    installations.ofAgent.mockResolvedValue(named(textAt(agent, "installation_name")))
    installations.find.mockResolvedValue(
        given === undefined ? null : mock<InstallationRecord>({ ...given, moduleKey: "chatbot" }),
    )
    installations.findById.mockResolvedValue(named(textAt(resolved, "name")))
    return { agents, installations }
}

/** The work item chain reads answering the named reads. */
const chainsOf = (queries: Queries): MockOf<WorkItemsChainReadService> => {
    const [parent] = rowsAt(queries, FIND_PARENT_POSITION)
    const [top] = rowsAt(queries, FIND_CHAIN_TOP)
    const spot = parent === undefined ? null : { id: parent.id, chainId: parent.chain_id, depth: parent.depth }
    const chains = mock<WorkItemsChainReadService>()
    chains.spotOf.mockResolvedValue(spot)
    chains.topDepth.mockResolvedValue(top === undefined ? null : top.depth)
    chains.repeats.mockResolvedValue(rowsAt(queries, CHAIN_REPEATS_COMMAND).some((row) => row.repeats === true))
    return chains
}

/** The readers of the readable label of a subject, answering the named label (or all rejecting when the lookup is unreadable). */
const labelsOf = (queries: Queries): Pick<Served, "orders" | "leads" | "invoices"> => {
    const text = textAt(rowsAt(queries, FIND_SUBJECT_LABEL)[0], "label")
    const failing = queries.some(([key]) => key === UNREADABLE)
    const read = <T>(value: T): Promise<T> =>
        failing ? Promise.reject(new RangeError("lookup failed")) : Promise.resolve(value)
    const card = { id: "lead-1", contactName: text ?? "", company: "", channel: "", stage: "new", email: null }
    const invoice = { id: "invoice-1", invoiceNo: text ?? "", amountVnd: 0, leadId: null, paidAt: null }
    const orders = mock<OrdersLabelReadService>()
    orders.numbersOf.mockImplementation(() => read(text === null ? [] : [{ id: "order-1", orderNo: text }]))
    const leads = mock<LeadReadService>()
    leads.cardsOf.mockImplementation(() => read(text === null ? [] : [card]))
    const invoices = mock<InvoicesLedgerService>()
    invoices.receiptInvoice.mockImplementation(() => read(text === null ? null : invoice))
    return { orders, leads, invoices }
}

/** A manager and owner services that answer the named reads with their rows; with no reads they answer nothing. */
export const serve = (queries: Queries = []): Served => {
    const resolved = rowsAt(queries, RESOLVE_INSTALLATION)
    const em = queries.some(([key]) => key === RESOLVE_INSTALLATION)
        ? mockEntityManager({
              query: [RESOLVE_INSTALLATION, resolved.map(({ installation_id, via }) => ({ installation_id, via }))],
          })
        : mockEntityManager()
    return { em, ...senders(queries), chains: chainsOf(queries), ...labelsOf(queries) }
}
