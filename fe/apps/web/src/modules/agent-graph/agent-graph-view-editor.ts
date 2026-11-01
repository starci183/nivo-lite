import type {
    AgentGraphBranchForm,
    AgentGraphChangeLine,
    AgentGraphData,
    AgentGraphEditorView,
    AgentGraphOnTimeout,
    AgentGraphOptionView,
    AgentGraphThen,
} from "@/modules/types"
import { changesOf, isFormSavable, isWideningOf, rightOf } from "./agent-graph-edit"
import { branchHitOf } from "./agent-graph-flow"
import { thenWordOf, timeoutWordOf } from "./agent-graph-words"
import type { AgentGraphContext, AgentGraphT } from "./agent-graph-words"

const THENS: ReadonlyArray<AgentGraphThen> = ["auto", "ask", "stop"]
const TIMEOUTS: ReadonlyArray<AgentGraphOnTimeout> = ["backup", "stop", "agent_owner", "unset"]

/** A change line in the owner's words: "Dinh becomes Mr Nam". */
const changeWordOf = (t: AgentGraphT, line: AgentGraphChangeLine): string => {
    if (line.kind === "bounds") return t("changeBounds", { before: line.before, after: line.after })
    if (line.kind === "approver") return t("changeApprover", { before: line.before, after: line.after })
    if (line.kind === "timeout") return t("changeTimeout")
    const words = (value: string): string => {
        const then = THENS.find((entry) => entry === value)
        return then === undefined ? value : thenWordOf(t, then)
    }
    return t("changeThen", { before: words(line.before), after: words(line.after) })
}

/** The verdict on the approver's right, and its words. */
const rightViewOf = (
    t: AgentGraphT,
    form: AgentGraphBranchForm,
    data: AgentGraphData,
): Pick<AgentGraphEditorView, "rightTone" | "rightText"> => {
    const right = rightOf(form, data.members)
    const name = data.members.find((entry) => entry.id === form.approverId)?.name ?? ""
    if (right === "covers") return { rightTone: "covers", rightText: t("rightCovers", { name }) }
    if (right === "short") return { rightTone: "short", rightText: t("rightShort", { name }) }
    if (right === "missing") return { rightTone: "short", rightText: t("rightMissing") }
    return { rightTone: "none", rightText: "" }
}

/** The node the person selected and the form of its branch. */
export interface AgentGraphSelection {
    readonly nodeKey: string
    readonly form: AgentGraphBranchForm
}

const optionsOf = <T extends string>(
    values: ReadonlyArray<T>,
    word: (value: T) => string,
): ReadonlyArray<AgentGraphOptionView> => values.map((value) => ({ value, label: word(value) }))

/**
 * The form of the branch the selected node answers, with the right of the chosen approver checked against the top of the branch, and
 * what saving would change in the draft. Null when the selected node is not the answer of a branch.
 */
export const editorViewOf = (
    data: AgentGraphData,
    selection: AgentGraphSelection,
    ctx: AgentGraphContext,
): AgentGraphEditorView | null => {
    const { t } = ctx
    const hit = branchHitOf(data.nodes, selection.nodeKey)
    if (hit === null) return null
    const { form } = selection
    const changes = changesOf(hit.branch, form, data.members, ctx.number).map((line) => changeWordOf(t, line))
    const was = hit.branch.approver?.name ?? ""
    const chosen = data.members.find((entry) => entry.id === form.approverId)?.name ?? ""
    const isWiden = isWideningOf(hit.branch, form)
    return {
        title: t("editTitle"),
        hint: t("editHint"),
        form,
        labels: {
            from: t("fieldFrom"),
            to: t("fieldTo"),
            then: t("fieldThen"),
            approver: t("fieldApprover"),
            hours: t("fieldHours"),
            onTimeout: t("fieldOnTimeout"),
            backup: t("fieldBackup"),
        },
        thenOptions: optionsOf(THENS, (value) => thenWordOf(t, value)),
        memberOptions: data.members.map((member) => ({ value: member.id, label: member.name })),
        timeoutOptions: optionsOf(TIMEOUTS, (value) => timeoutWordOf(t, value)),
        approverHelp: was !== "" && was !== chosen ? t("approverWas", { name: was }) : "",
        ...rightViewOf(t, form, data),
        changesTitle: t("changesTitle"),
        changes:
            changes.length === 0
                ? []
                : [...changes, isWiden ? t("changeWidens") : t("changeNoWiden"), t("changeSource")],
        saveLabel: t("saveDraft"),
        cancelLabel: t("cancel"),
        isSavable: changes.length > 0 && isFormSavable(form, data.members) && (!isWiden || ctx.isOwner),
    }
}
