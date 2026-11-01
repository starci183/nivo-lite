import type { AgentGraphData, AgentGraphNodeData } from "@/modules/types"
import type { AgentGraphT } from "./agent-graph-words"

/** What a sentence about a problem names: the step, the branch, and what the back end kept to say what is wrong. */
interface ProblemSubject {
    readonly node: string
    readonly branch: string
    readonly detail: string
}

const BLANK_ANSWERS = ["title", "does", "knows", "uses", "reads", "writes", "sources", "approver"] as const

/** The word of the answer a step left blank. */
const blankWordOf = (t: AgentGraphT, answer: string): string => {
    const words: Readonly<Record<(typeof BLANK_ANSWERS)[number], string>> = {
        title: t("blank_title"),
        does: t("q_does"),
        knows: t("q_knows"),
        uses: t("q_uses"),
        reads: t("q_reads"),
        writes: t("q_writes"),
        sources: t("q_sources"),
        approver: t("q_approver"),
    }
    const known = BLANK_ANSWERS.find((entry) => entry === answer)
    return known === undefined ? answer : words[known]
}

/** Why a condition is wrong, in words: the back end names it as `reason:fact`. */
const conditionWhyOf = (t: AgentGraphT, detail: string): string => {
    const reason = detail.split(":", 1).join("")
    if (reason === "unknown_fact") return t("condition_unknown_fact")
    if (reason === "wrong_type") return t("condition_wrong_type")
    if (reason === "wrong_op") return t("condition_wrong_op")
    if (reason === "wrong_value") return t("condition_wrong_value")
    if (reason === "too_deep") return t("condition_too_deep")
    if (reason === "too_many_terms") return t("condition_too_many_terms")
    return t("condition_empty_group")
}

/** The sentence about one problem, in plain words, naming the step and the branch it is about. */
export const problemWordsOf = (
    t: AgentGraphT,
    problem: AgentGraphData["problems"][number],
    subject: ProblemSubject,
): string => {
    const { node, branch, detail } = subject
    const words: Readonly<Record<string, string>> = {
        cycle: t("problem_cycle", { node }),
        no_trigger: t("problem_no_trigger"),
        not_from_trigger: t("problem_not_from_trigger", { node }),
        bad_step: t("problem_bad_step", { node }),
        branch_no_output: t("problem_branch_no_output", { branch }),
        dead_end: t("problem_dead_end", { node }),
        node_limit: t("problem_node_limit"),
        no_else: t("problem_no_else", { node }),
        else_auto: t("problem_else_auto", { node }),
        gap: t("problem_gap", { branch }),
        overlap: t("problem_overlap", { branch }),
        ceiling: t("problem_ceiling", { branch }),
        no_right: t("problem_no_right", { node }),
        placeholder_live: t("problem_placeholder_live", { node }),
        approver_no_grant: t("problem_approver_no_grant", { branch }),
        blank_answer: t("problem_blank_answer", { node, answer: blankWordOf(t, detail) }),
        on_timeout_unset: t("problem_on_timeout_unset", { branch }),
        approver_missing: t("problem_approver_missing", { branch }),
        no_data_right: t("problem_no_data_right", { node }),
        outsider_wide: t("problem_outsider_wide"),
        bad_condition: t("problem_bad_condition", { branch, why: conditionWhyOf(t, detail) }),
    }
    return words[problem.code] ?? t("problem_other", { node })
}

/** One problem for the owner: where it is and what to do about it, in words. */
export interface AgentGraphProblemLine {
    readonly id: string
    /** The step to open, so the owner can fix it where it stands. */
    readonly nodeKey: string
    readonly branchKey: string
    readonly text: string
    /** True when the fix is a grant: the owner opens the page where rights are given. */
    readonly isGrant: boolean
}

const titleOf = (nodes: ReadonlyArray<AgentGraphNodeData>, key: string): string =>
    nodes.find((entry) => entry.key === key)?.title ?? key

/** Every problem the checks found, in the owner's words, in the order the back end listed them. */
export const problemLinesOf = (data: AgentGraphData, t: AgentGraphT): ReadonlyArray<AgentGraphProblemLine> =>
    data.problems.map((problem, index) => {
        const parent = data.nodes.find((entry) => entry.key === problem.nodeKey)
        const branch = parent?.branches.find((entry) => entry.key === problem.branchKey)
        return {
            id: `${problem.code}-${problem.nodeKey}-${problem.branchKey}-${index}`,
            nodeKey: problem.nodeKey,
            branchKey: problem.branchKey,
            text: problemWordsOf(t, problem, {
                node: titleOf(data.nodes, problem.nodeKey),
                branch: branch === undefined ? "" : branch.whenFull,
                detail: problem.detail,
            }),
            isGrant:
                problem.code === "approver_no_grant" || problem.code === "no_right" || problem.code === "no_data_right",
        }
    })
