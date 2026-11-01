import type {
    AgentGraphAdderView,
    AgentGraphData,
    AgentGraphDecideEditorView,
    AgentGraphDecideForm,
    AgentGraphFactData,
    AgentGraphOnTimeout,
    AgentGraphOptionView,
    AgentGraphProblemsView,
    AgentGraphRowForm,
    AgentGraphRowView,
    AgentGraphTermForm,
    AgentGraphTermView,
    AgentGraphThen,
} from "@/modules/types"
import { opsOfFact, termsWords } from "./agent-graph-condition"
import type { AgentGraphConditionWords } from "./agent-graph-condition"
import { KEEP_GROUP, MAX_ROWS, MAX_TERMS } from "./agent-graph-decide-form"
import { problemLinesOf } from "./agent-graph-problems"
import { thenWordOf, timeoutWordOf } from "./agent-graph-words"
import type { AgentGraphContext, AgentGraphT } from "./agent-graph-words"

const THENS: ReadonlyArray<AgentGraphThen> = ["auto", "ask", "stop"]
const TIMEOUTS: ReadonlyArray<AgentGraphOnTimeout> = ["backup", "stop", "agent_owner", "unset"]

const optionsOf = <T extends string>(
    values: ReadonlyArray<T>,
    word: (value: T) => string,
): ReadonlyArray<AgentGraphOptionView> => values.map((value) => ({ value, label: word(value) }))

/** The word of how a fact is compared. */
const opLabelOf = (t: AgentGraphT, op: string): string => {
    const words: Readonly<Record<string, string>> = {
        lt: t("op_lt"),
        lte: t("op_lte"),
        gt: t("op_gt"),
        gte: t("op_gte"),
        eq: t("op_eq"),
        neq: t("op_neq"),
        in: t("op_in"),
        known: t("op_known"),
    }
    return words[op] ?? op
}

const termViewOf = (
    term: AgentGraphTermForm,
    id: string,
    count: number,
    words: AgentGraphConditionWords,
    isLocked: boolean,
): AgentGraphTermView => {
    const { t } = words
    const fact = words.facts.find((entry) => entry.key === term.fact)
    const input = ((): AgentGraphTermView["input"] => {
        if (term.op === "known") return "none"
        if (fact?.type === "number") return "number"
        if (fact?.type === "boolean") return "choice"
        return fact !== undefined && fact.allowed.length > 0 && term.op !== "in" ? "choice" : "text"
    })()
    const valueOptions: ReadonlyArray<AgentGraphOptionView> =
        fact?.type === "boolean"
            ? [
                  { value: "true", label: t("valueYes") },
                  { value: "false", label: t("valueNo") },
              ]
            : (fact?.allowed ?? []).map((value) => ({ value, label: value }))
    return {
        ...term,
        id,
        input,
        opOptions: opsOfFact(fact).map((op) => ({ value: op, label: opLabelOf(t, op) })),
        valueOptions,
        amountWords: fact?.unit === "vnd" && input === "number" ? words.amount(term.amount) : "",
        canRemove: count > 1 && !isLocked,
    }
}

/** What the form itself finds wrong with a row, before anything is saved. */
const approverErrorOf = (row: AgentGraphRowForm, t: AgentGraphT): string =>
    row.then === "ask" && row.approverId === "" ? t("errApprover") : ""

const backupErrorOf = (row: AgentGraphRowForm, t: AgentGraphT): string =>
    row.then === "ask" && row.onTimeout === "backup" && row.backupId === "" ? t("errBackup") : ""

/** One row of the editor. */
const rowViewOf = (
    form: AgentGraphDecideForm,
    row: AgentGraphRowForm,
    index: number,
    data: AgentGraphData,
    ctx: AgentGraphContext,
): AgentGraphRowView => {
    const { t } = ctx
    const words: AgentGraphConditionWords = { t, facts: data.facts, amount: ctx.amount }
    const next = form.rows[index + 1]
    const keptName = data.nodes
        .find((entry) => entry.key === form.nodeKey)
        ?.branches.find((entry) => entry.key === row.key)?.approver?.name
    const members = data.members.map((member) => ({ value: member.id, label: member.name }))
    const sentence = (() => {
        if (row.isElse) return t("whenAny")
        if (row.isLocked)
            return (
                data.nodes.find((entry) => entry.key === form.nodeKey)?.branches.find((entry) => entry.key === row.key)
                    ?.whenFull ?? ""
            )
        return termsWords(row.terms, words, true)
    })()
    const problems = problemLinesOf(data, t)
        .filter((line) => line.nodeKey === form.nodeKey && row.key !== "" && line.branchKey === row.key)
        .map((line) => line.text)
    const id = row.key === "" ? `new-${index}` : row.key
    return {
        id,
        index,
        title: row.isElse ? t("rowElse") : t("rowN", { n: index + 1 }),
        isElse: row.isElse,
        isLocked: row.isLocked,
        sentence,
        terms: row.terms.map((term, at) => termViewOf(term, `${id}-${at}`, row.terms.length, words, row.isLocked)),
        canAddTerm: !row.isElse && !row.isLocked && row.terms.length < MAX_TERMS,
        then: row.then,
        approverId: row.approverId,
        approverOptions:
            row.approverId === KEEP_GROUP
                ? [{ value: KEEP_GROUP, label: t("approverKeep", { name: keptName ?? "" }) }, ...members]
                : members,
        timeoutHours: row.timeoutHours,
        onTimeout: row.onTimeout,
        backupId: row.backupId,
        canMoveUp: !row.isElse && index > 0,
        canMoveDown: !row.isElse && next !== undefined && !next.isElse,
        canRemove: !row.isElse && form.rows.length > 1,
        approverError: approverErrorOf(row, t),
        backupError: backupErrorOf(row, t),
        problems,
    }
}

/** Why the form may not be saved to the draft; empty when it may. */
const saveBlockedOf = (
    form: AgentGraphDecideForm,
    start: AgentGraphDecideForm | null,
    ctx: AgentGraphContext,
): string => {
    if (!ctx.canEdit) return ctx.t("cannotEdit")
    if (form.rows.some((row) => approverErrorOf(row, ctx.t) !== "" || backupErrorOf(row, ctx.t) !== ""))
        return ctx.t("errFix")
    return start !== null && JSON.stringify(start) === JSON.stringify(form) ? ctx.t("nothingChanged") : ""
}

/**
 * The editor of the decision point the owner opened: one row for each branch with its condition rows (a fact, how it is compared, a
 * value), what happens, who is asked and what happens when nobody answers, with the problems the back end found beside the row
 * they are about. The last row is the "else", which never moves and never runs alone.
 */
export const decideEditorViewOf = (
    data: AgentGraphData,
    form: AgentGraphDecideForm,
    start: AgentGraphDecideForm | null,
    ctx: AgentGraphContext,
): AgentGraphDecideEditorView => {
    const { t } = ctx
    return {
        title: t("decideTitle"),
        hint: t("decideHint"),
        rows: form.rows.map((row, index) => rowViewOf(form, row, index, data, ctx)),
        labels: {
            fact: t("fieldFact"),
            op: t("fieldOp"),
            value: t("fieldValue"),
            amount: t("fieldAmount"),
            then: t("fieldThen"),
            approver: t("fieldApprover"),
            hours: t("fieldHours"),
            onTimeout: t("fieldOnTimeout"),
            backup: t("fieldBackup"),
            addTerm: t("addTerm"),
            removeTerm: t("removeTerm"),
            moveUp: t("moveUp"),
            moveDown: t("moveDown"),
            removeRow: t("removeRow"),
            lockedNote: t("lockedNote"),
            elseNote: t("elseNote"),
            allTerms: t("allTerms"),
        },
        factOptions: data.facts.map((fact) => ({ value: fact.key, label: fact.label })),
        thenOptions: optionsOf(THENS, (value) => thenWordOf(t, value)),
        memberOptions: data.members.map((member) => ({ value: member.id, label: member.name })),
        timeoutOptions: optionsOf(TIMEOUTS, (value) => timeoutWordOf(t, value)),
        addRowLabel: t("addRow"),
        canAddRow: form.rows.length < MAX_ROWS && data.facts.length > 0,
        saveLabel: t("saveDraft"),
        cancelLabel: t("cancel"),
        saveBlocked: saveBlockedOf(form, start, ctx),
    }
}

/** The problems of the draft as a list in the owner's words, each with the step to open. */
export const problemsViewOf = (data: AgentGraphData, ctx: AgentGraphContext): AgentGraphProblemsView => {
    const { t } = ctx
    const lines = problemLinesOf(data, t)
    const absent = data.gaps
        .filter((gap) => gap.code === "approver_absent")
        .map((gap, index) => ({
            id: `absent-${gap.nodeKey}-${gap.branchKey}-${index}`,
            nodeKey: gap.nodeKey,
            text: t("gap_approver_absent", {
                branch:
                    data.nodes
                        .find((entry) => entry.key === gap.nodeKey)
                        ?.branches.find((entry) => entry.key === gap.branchKey)?.whenFull ?? "",
            }),
            isGrant: false,
        }))
    return {
        title: t("problemsTitle", { count: lines.length + absent.length }),
        items: [
            ...lines.map((line) => ({ id: line.id, nodeKey: line.nodeKey, text: line.text, isGrant: line.isGrant })),
            ...absent,
        ],
        openLabel: t("problemOpen"),
        grantLabel: t("problemGrant"),
        moreLabel: t("problemsMore", { count: Math.max(0, lines.length + absent.length - 1) }),
    }
}

/** What the owner picked to add, or the first of each when nothing was picked yet. */
export interface AgentGraphAdderPick {
    readonly action: string
    readonly fact: string
}

/** The fact an added decision point starts on: the first amount in dong, as a limit is usually about money. */
const defaultFactOf = (facts: ReadonlyArray<AgentGraphFactData>): AgentGraphFactData | undefined =>
    facts.find((fact) => fact.unit === "vnd") ?? facts[0]

/** The two choices that add a decision point to an agent that has none: which action it guards, and on which fact. */
export const adderViewOf = (
    data: AgentGraphData,
    pick: AgentGraphAdderPick,
    ctx: AgentGraphContext,
): AgentGraphAdderView => {
    const { t } = ctx
    const actions = data.actions.filter((action) => !action.isGuarded)
    const blocked = (() => {
        if (!ctx.canEdit) return t("cannotEdit")
        if (actions.length === 0) return t("adderNothing")
        return data.facts.length === 0 ? t("adderNoFacts") : ""
    })()
    return {
        title: t("adderTitle"),
        hint: t("adderHint"),
        actionLabel: t("adderAction"),
        factLabel: t("adderFact"),
        action: pick.action,
        fact: pick.fact,
        actions: actions.map((action) => ({ value: action.action, label: action.title })),
        facts: data.facts.map((fact) => ({ value: fact.key, label: fact.label })),
        addLabel: t("adderAdd"),
        blocked,
    }
}

/** The action and the fact the adder shows as picked: the owner's choice when it still stands, else the first of each. */
export const adderPickOf = (data: AgentGraphData, picked: AgentGraphAdderPick): AgentGraphAdderPick => ({
    action: data.actions.some((action) => action.action === picked.action && !action.isGuarded)
        ? picked.action
        : (data.actions.find((action) => !action.isGuarded)?.action ?? ""),
    fact: data.facts.some((fact) => fact.key === picked.fact) ? picked.fact : (defaultFactOf(data.facts)?.key ?? ""),
})
