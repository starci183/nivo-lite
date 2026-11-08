import { withLeafValue } from "./condition"
import type { AgentTemplatePackage, ParameterBinding, ParameterValue, TemplateParameter } from "./format.types"
import type { GraphBranch, GraphDocument, GraphNode } from "./graph.types"

/** The title and sentence limits of a node, kept when a value is written into them. */
const TITLE_MAX = 28
const DOES_MAX = 200

/** The values the buyer gave, by parameter key. */
export type ParameterValues = Readonly<Record<string, ParameterValue>>

/** The values to use: what the buyer gave, else the default; the reasons a value is refused otherwise. */
export interface ResolvedValues {
    /** The values to use, one for each parameter. */
    readonly values: ParameterValues
    /** Why a value is refused: the key and the reason. */
    readonly problems: ReadonlyArray<string>
}

/** A time of day written HH:MM. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/

const numberFits = (parameter: TemplateParameter, value: ParameterValue): string | null => {
    if (typeof value !== "number" || !Number.isFinite(value)) return `${parameter.key}: a number is needed`
    if (parameter.min !== null && value < parameter.min) return `${parameter.key}: below ${parameter.min}`
    return parameter.max !== null && value > parameter.max ? `${parameter.key}: above ${parameter.max}` : null
}

const textFits = (parameter: TemplateParameter, value: string): string | null => {
    if (parameter.kind === "time")
        return TIME_OF_DAY.test(value) ? null : `${parameter.key}: a time like 09:00 is needed`
    if (parameter.kind !== "choice") return null
    const isOption = (parameter.options ?? []).some((option) => option.value === value)
    return isOption ? null : `${parameter.key}: pick one of the choices`
}

const fits = (parameter: TemplateParameter, value: ParameterValue): string | null => {
    if (parameter.kind === "number") return numberFits(parameter, value)
    if (parameter.kind === "toggle") return typeof value === "boolean" ? null : `${parameter.key}: yes or no is needed`
    return typeof value === "string" ? textFits(parameter, value) : `${parameter.key}: a text is needed`
}

/** Checks the buyer's values against the parameters of the package and fills the gaps with the defaults. */
export const resolveValues = (parameters: ReadonlyArray<TemplateParameter>, given: ParameterValues): ResolvedValues => {
    const known = new Set(parameters.map((parameter) => parameter.key))
    const strays = Object.keys(given)
        .filter((key) => !known.has(key))
        .map((key) => `${key}: not a parameter of this template`)
    const entries = parameters.map((parameter) => {
        const value = given[parameter.key] ?? parameter.default
        const empty = typeof value === "string" && value.trim() === ""
        const missing = parameter.required && empty ? `${parameter.key}: required` : null
        return { key: parameter.key, value, problem: missing ?? fits(parameter, value) }
    })
    return {
        values: Object.fromEntries(entries.map((entry) => [entry.key, entry.value])),
        problems: [...strays, ...entries.flatMap((entry) => (entry.problem === null ? [] : [entry.problem]))],
    }
}

const fill = (text: string, values: ParameterValues, max: number): string => {
    const filled = text.replaceAll(/\{\{([a-z]\w*)\}\}/g, (whole, key: string) => {
        const value = values[key]
        return value === undefined ? whole : String(value)
    })
    return filled.length > max ? `${filled.slice(0, max - 1).trimEnd()}…` : filled
}

const bindingsOf = (
    bindings: ReadonlyArray<ParameterBinding>,
    node: GraphNode,
    branch: GraphBranch,
): ReadonlyArray<ParameterBinding> =>
    bindings.filter((binding) => binding.nodeKey === node.key && binding.branchKey === branch.key)

const branchWith = (
    branch: GraphBranch,
    bound: ReadonlyArray<ParameterBinding>,
    values: ParameterValues,
): GraphBranch => {
    const numbers = (binding: ParameterBinding): number | null => {
        const value = values[binding.parameter]
        return typeof value === "number" ? value : null
    }
    const valued = bound.reduce<GraphBranch["when"]>((when, binding) => {
        const value = numbers(binding)
        return binding.target === "branch_value" && value !== null && when !== "else"
            ? withLeafValue(when, binding.termIndex, value)
            : when
    }, branch.when)
    const [wait] = bound.flatMap((binding) => {
        const value = binding.target === "branch_timeout" ? numbers(binding) : null
        return value === null ? [] : [value]
    })
    return {
        ...branch,
        when: valued,
        approver:
            branch.approver === null || wait === undefined
                ? branch.approver
                : { ...branch.approver, timeoutMinutes: Math.max(1, Math.round(wait)) },
    }
}

/**
 * The graph a buyer gets from a package: the numbers of the bindings and the `{{key}}` of the texts replaced by the values, and no
 * data right, because a package never grants one. Only the numbers a condition compares with and the waits of approvers change; what a
 * branch does (auto, ask, stop) is the creator's, whatever the values are.
 */
export const instantiate = (pkg: AgentTemplatePackage, values: ParameterValues): GraphDocument => ({
    nodes: pkg.graph.nodes.map((node) => ({
        ...node,
        title: fill(node.title, values, TITLE_MAX),
        does: fill(node.does, values, DOES_MAX),
        ...(node.decide === undefined
            ? {}
            : {
                  decide: {
                      ...node.decide,
                      branches: node.decide.branches.map((branch) =>
                          branchWith(branch, bindingsOf(pkg.bindings, node, branch), values),
                      ),
                  },
              }),
    })),
    rights: [],
    ...(pkg.graph.contracts === undefined
        ? {}
        : {
              contracts: pkg.graph.contracts.map((contract) => ({
                  ...contract,
                  task: fill(contract.task, values, contract.task.length + 200),
                  limits: contract.limits.map((limit) => ({
                      ...limit,
                      text: fill(limit.text, values, limit.text.length + 200),
                  })),
              })),
          }),
})
