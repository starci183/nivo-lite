import type {
    AgentGraphDecideForm,
    AgentGraphFactData,
    AgentGraphFormChange,
    AgentGraphOnTimeout,
    AgentGraphOp,
    AgentGraphRowForm,
    AgentGraphTermForm,
    AgentGraphThen,
} from "@/modules/types"
import { isOp, newTermAfter, newTermOf, termsOfWhen } from "./agent-graph-condition"
import type { AgentGraphWireNode } from "./agent-graph-wire"

/** The value of the approver select that keeps the group of roles or rooms the branch already asks. */
export const KEEP_GROUP = "keep"

/** The most branches one decision point holds: the limit of the contract. */
export const MAX_ROWS = 12

/** The most comparisons one branch holds: the limit of the contract for the terms of a condition. */
export const MAX_TERMS = 6

const THENS: ReadonlyArray<AgentGraphThen> = ["auto", "ask", "stop"]
const TIMEOUTS: ReadonlyArray<AgentGraphOnTimeout> = ["backup", "stop", "agent_owner", "unset"]

const DEFAULT_HOURS = 4

/** A branch the owner has just added: it asks, so nothing it does is a surprise. */
const newRowOf = (term: AgentGraphTermForm): AgentGraphRowForm => ({
    key: "",
    isElse: false,
    isLocked: false,
    terms: [term],
    then: "ask",
    approverId: "",
    timeoutHours: DEFAULT_HOURS,
    onTimeout: "agent_owner",
    backupId: "",
})

/** The form of a decision point: one row for each of its branches, in the order they are tried. Null for a node that has none. */
export const decideFormOf = (node: AgentGraphWireNode): AgentGraphDecideForm | null => {
    const { decide } = node
    if (decide === undefined) return null
    return {
        nodeKey: node.key,
        rows: decide.branches.map((branch): AgentGraphRowForm => {
            const isElse = branch.when === "else"
            const terms = isElse ? [] : termsOfWhen(branch.when)
            const approver = branch.approver
            const member = approver?.group.members[0]
            const isGroup = approver !== null && member === undefined
            return {
                key: branch.key,
                isElse,
                isLocked: terms === null,
                terms: terms ?? [],
                then: branch.then,
                approverId: member ?? (isGroup ? KEEP_GROUP : ""),
                timeoutHours: approver === null ? DEFAULT_HOURS : Math.max(1, Math.round(approver.timeoutMinutes / 60)),
                onTimeout: approver?.onTimeout.kind ?? "agent_owner",
                backupId: approver?.onTimeout.group?.members[0] ?? "",
            }
        }),
    }
}

/** The index where a new branch goes: before the closing "else", or at the end when there is none. */
const insertAt = (rows: ReadonlyArray<AgentGraphRowForm>): number => {
    const last = rows.at(-1)
    return last?.isElse === true ? rows.length - 1 : rows.length
}

const replaceAt = <T>(items: ReadonlyArray<T>, index: number, change: (item: T) => T): ReadonlyArray<T> =>
    items.map((item, at) => (at === index ? change(item) : item))

const rowWithField = (
    row: AgentGraphRowForm,
    field: "then" | "approverId" | "timeoutHours" | "onTimeout" | "backupId",
    value: string | number,
): AgentGraphRowForm => {
    if (typeof value === "number") return field === "timeoutHours" ? { ...row, timeoutHours: Math.max(1, value) } : row
    if (field === "approverId") return { ...row, approverId: value }
    if (field === "backupId") return { ...row, backupId: value }
    const then = THENS.find((entry) => entry === value)
    if (field === "then" && then !== undefined) return { ...row, then }
    const onTimeout = TIMEOUTS.find((entry) => entry === value)
    return field === "onTimeout" && onTimeout !== undefined ? { ...row, onTimeout } : row
}

/** The rows after one change; a change that makes no sense (moving the "else", removing the last branch) changes nothing. */
const rowsWithChange = (
    rows: ReadonlyArray<AgentGraphRowForm>,
    change: AgentGraphFormChange,
    facts: ReadonlyArray<AgentGraphFactData>,
): ReadonlyArray<AgentGraphRowForm> => {
    const factOf = (key: string): AgentGraphFactData | undefined => facts.find((entry) => entry.key === key)
    if (change.kind === "addRow") {
        if (rows.length >= MAX_ROWS) return rows
        const at = insertAt(rows)
        const previous = rows[at - 1]?.terms.at(-1)
        const lead = previous ?? rows.flatMap((row) => row.terms)[0]
        const term = newTermAfter(factOf(lead?.fact ?? "") ?? facts[0], previous)
        return [...rows.slice(0, at), newRowOf(term), ...rows.slice(at)]
    }
    if (change.kind === "removeRow") {
        const row = rows[change.row]
        return row === undefined || row.isElse || rows.length <= 1 ? rows : rows.filter((_, at) => at !== change.row)
    }
    if (change.kind === "moveRow") {
        const to = change.row + change.delta
        const row = rows[change.row]
        const other = rows[to]
        if (row === undefined || other === undefined || row.isElse || other.isElse) return rows
        return rows.map((entry, at) => {
            if (at === change.row) return other
            return at === to ? row : entry
        })
    }
    if (change.kind === "addTerm")
        return replaceAt(rows, change.row, (row) =>
            row.isElse || row.isLocked || row.terms.length >= MAX_TERMS
                ? row
                : { ...row, terms: [...row.terms, newTermAfter(factOf(row.terms[0]?.fact ?? "") ?? facts[0], row.terms.at(-1))] },
        )
    if (change.kind === "removeTerm")
        return replaceAt(rows, change.row, (row) =>
            row.terms.length <= 1 ? row : { ...row, terms: row.terms.filter((_, at) => at !== change.term) },
        )
    if (change.kind === "setTerm")
        return replaceAt(rows, change.row, (row) => ({
            ...row,
            terms: replaceAt(row.terms, change.term, (term) => {
                if (change.field === "fact") return newTermOf(factOf(String(change.value)))
                if (change.field === "op") return { ...term, op: opFrom(change.value, term.op) }
                if (change.field === "amount") return { ...term, amount: Number(change.value) }
                return { ...term, text: String(change.value) }
            }),
        }))
    return replaceAt(rows, change.row, (row) => rowWithField(row, change.field, change.value))
}

/** The operator a select answered, or the one the term had when the answer is none of them. */
const opFrom = (value: string | number, fallback: AgentGraphOp): AgentGraphOp => {
    const text = String(value)
    return isOp(text) ? text : fallback
}

/** The form after one change the owner made. */
export const formWithChange = (
    form: AgentGraphDecideForm,
    change: AgentGraphFormChange,
    facts: ReadonlyArray<AgentGraphFactData>,
): AgentGraphDecideForm => ({ ...form, rows: rowsWithChange(form.rows, change, facts) })
