import { hashOfPackage } from "./canonical"
import { leavesOf } from "./condition"
import { TEMPLATE_FORMAT } from "./format.types"
import type {
    AgentTemplatePackage,
    PackageDraft,
    PackagePreview,
    PackageReport,
    ParameterBinding,
} from "./format.types"
import type {
    BranchApprover,
    Condition,
    DecidePoint,
    GraphBranch,
    GraphDocument,
    GraphNode,
    GraphSource,
} from "./graph.types"

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const EMAIL = /[^\s@"]+@[^\s@"]+\.[a-z]{2,}/i
const SECRET =
    /(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|-----BEGIN [A-Z ]*KEY|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|api[_-]?key\s*[:=]\s*\S{8,}|password\s*[:=]\s*\S+)/i

/** A counter of what was left out while the graph was rebuilt. */
interface Tally {
    brainRefs: number
    privateSources: number
    people: number
}

const emptyGroup = (
    roles: ReadonlyArray<"owner" | "manager" | "staff">,
): { roles: typeof roles; rooms: []; members: [] } => ({
    roles,
    rooms: [],
    members: [],
})

const approverOf = (approver: BranchApprover | null, tally: Tally): BranchApprover | null => {
    if (approver === null) return null
    tally.people += approver.group.rooms.length + approver.group.members.length
    const timeout = approver.onTimeout
    if (timeout.kind === "backup") tally.people += timeout.group.rooms.length + timeout.group.members.length
    return {
        group: emptyGroup(approver.group.roles),
        policy: approver.policy,
        timeoutMinutes: approver.timeoutMinutes,
        onTimeout: timeout.kind === "backup" ? { kind: "backup", group: emptyGroup(timeout.group.roles) } : timeout,
    }
}

/** What a source becomes: the template itself when it had any, never a chat, a person, a proposal or a passage of the Brain. */
const sourcesOf = (
    sources: ReadonlyArray<GraphSource>,
    draft: PackageDraft,
    tally: Tally,
): ReadonlyArray<GraphSource> => {
    if (sources.length === 0) return []
    for (const source of sources) {
        if (source.kind === "brain") tally.brainRefs += 1
        else if (source.kind !== "rule" && source.kind !== "template") tally.privateSources += 1
    }
    const rules = sources.filter((source) => source.kind === "rule")
    return [...rules, { kind: "template", key: draft.key, version: draft.version }]
}

const branchOf = (branch: GraphBranch, draft: PackageDraft, tally: Tally): GraphBranch => ({
    key: branch.key,
    when: branch.when,
    then: branch.then,
    next: branch.next,
    approver: approverOf(branch.approver, tally),
    sources: sourcesOf(branch.sources, draft, tally),
})

const decideOf = (decide: DecidePoint, draft: PackageDraft, tally: Tally): DecidePoint => ({
    intent: decide.intent,
    facts: [...decide.facts],
    branches: decide.branches.map((branch) => branchOf(branch, draft, tally)),
})

/** Rebuilds a node field by field from the allowlist: a field nobody named here is not in the package. */
const nodeOf = (node: GraphNode, draft: PackageDraft, tally: Tally): GraphNode => {
    tally.brainRefs += node.knows.length
    return {
        key: node.key,
        kind: node.kind,
        step: node.step,
        title: node.title,
        doneBy: node.doneBy,
        knows: node.knows.map((item) => ({ kind: item.kind, ref: "", label: item.label })),
        does: node.does,
        uses: node.uses.map((use) => ({
            provider: use.provider,
            tool: use.tool,
            scope: use.scope,
            label: use.label,
            ...(use.placeholder === undefined ? {} : { placeholder: use.placeholder }),
        })),
        reads: node.reads.map((item) => ({ fact: item.fact, label: item.label, place: item.place })),
        writes: node.writes.map((item) => ({ fact: item.fact, label: item.label, place: item.place })),
        approver: approverOf(node.approver, tally),
        sources: sourcesOf(node.sources, draft, tally),
        none: [...node.none],
        next: [...node.next],
        ...(node.decide === undefined ? {} : { decide: decideOf(node.decide, draft, tally) }),
        ...(node.action === undefined ? {} : { action: node.action }),
        ...(node.pipeline === undefined ? {} : { pipeline: node.pipeline }),
        ...(node.trigger === undefined
            ? {}
            : { trigger: { eventTypes: [...node.trigger.eventTypes], sources: [...node.trigger.sources] } }),
        ...(node.handoverTo === undefined ? {} : { handoverTo: node.handoverTo }),
        ...(node.triggerSources === undefined ? {} : { triggerSources: [...node.triggerSources] }),
    }
}

const contractsOf = (graph: GraphDocument, tally: Tally): GraphDocument["contracts"] =>
    graph.contracts?.map((contract) => {
        tally.privateSources +=
            contract.sources.length + contract.limits.reduce((sum, limit) => sum + limit.sources.length, 0)
        return {
            intent: contract.intent,
            task: contract.task,
            limits: contract.limits.map((limit) => ({
                text: limit.text,
                triggers: [...limit.triggers],
                trusts: [...limit.trusts],
                sources: [],
            })),
            sources: [],
        }
    })

/** Every string of a value with the path it sits at. */
const stringsOf = (value: unknown, path: string): ReadonlyArray<readonly [string, string]> => {
    if (typeof value === "string") return [[path, value]]
    if (Array.isArray(value)) return value.flatMap((item: unknown, index) => stringsOf(item, `${path}[${index}]`))
    if (typeof value === "object" && value !== null) {
        return Object.entries(value).flatMap(([name, member]) => stringsOf(member, `${path}.${name}`))
    }
    return []
}

/**
 * The last check: no string of the package may be an id, an address or a secret, and none may carry an id the creator's workspace
 * named. Free text can still hold a name only a person sees, which the creator reads in the preview.
 */
export const leakProblems = (body: unknown, forbidden: ReadonlyArray<string>): ReadonlyArray<string> =>
    stringsOf(body, "$").flatMap(([path, text]) => {
        const lower = text.toLowerCase()
        if (UUID.test(text)) return [`${path}: an id`]
        if (EMAIL.test(text)) return [`${path}: an email address`]
        if (SECRET.test(text)) return [`${path}: a secret`]
        return forbidden.some((id) => id !== "" && lower.includes(id.toLowerCase()))
            ? [`${path}: an id of the creator`]
            : []
    })

const bindingProblems = (graph: GraphDocument, draft: PackageDraft): ReadonlyArray<string> => {
    const keys = new Set(draft.parameters.map((parameter) => parameter.key))
    return draft.bindings.flatMap((binding): ReadonlyArray<string> => {
        if (!keys.has(binding.parameter)) return [`binding: unknown parameter ${binding.parameter}`]
        const node = graph.nodes.find((entry) => entry.key === binding.nodeKey)
        const branch = node?.decide?.branches.find((entry) => entry.key === binding.branchKey)
        if (branch === undefined)
            return [`binding ${binding.parameter}: no branch ${binding.nodeKey}/${binding.branchKey}`]
        if (binding.target === "branch_timeout")
            return branch.approver === null ? [`binding ${binding.parameter}: the branch asks nobody`] : []
        const leaf = branch.when === "else" ? undefined : leavesOf(branch.when)[binding.termIndex]
        return leaf !== undefined && "value" in leaf && typeof leaf.value === "number"
            ? []
            : [`binding ${binding.parameter}: term ${binding.termIndex} is not a number`]
    })
}

/** Numbers of the graph a creator could turn into parameters: the numbers conditions compare with and the waits of approvers. */
export const suggestionsOf = (graph: GraphDocument): ReadonlyArray<ParameterBinding> =>
    graph.nodes.flatMap((node) =>
        (node.decide?.branches ?? []).flatMap((branch): ReadonlyArray<ParameterBinding> => {
            const leaves = branch.when === "else" ? [] : leavesOf(branch.when)
            const values = leaves.flatMap((leaf: Condition, termIndex) =>
                "value" in leaf && typeof leaf.value === "number"
                    ? [
                          {
                              parameter: `${node.key}_${branch.key}_${termIndex}`,
                              target: "branch_value" as const,
                              nodeKey: node.key,
                              branchKey: branch.key,
                              termIndex,
                          },
                      ]
                    : [],
            )
            const wait =
                branch.approver === null
                    ? []
                    : [
                          {
                              parameter: `${node.key}_${branch.key}_wait`,
                              target: "branch_timeout" as const,
                              nodeKey: node.key,
                              branchKey: branch.key,
                          },
                      ]
            return [...values, ...wait]
        }),
    )

const requiredActionsOf = (graph: GraphDocument): ReadonlyArray<string> => [
    ...new Set(
        graph.nodes.flatMap((node) => [
            ...(node.action === undefined ? [] : [node.action]),
            ...(node.decide === undefined ? [] : [node.decide.intent]),
        ]),
    ),
]

/**
 * Packages a frozen graph version, by an allowlist: the package is built field by field from what the format names, so nothing else
 * of the creator's agent can reach it. The Brain is cut from the nodes, chats and people from the sources, members and rooms from the
 * approvers, and the data rights become proposals. Then the finished package is scanned for ids, addresses and secrets.
 */
export const previewPackage = (graph: GraphDocument, draft: PackageDraft): PackagePreview => {
    const tally: Tally = { brainRefs: 0, privateSources: 0, people: 0 }
    const rebuilt: GraphDocument = {
        nodes: graph.nodes.map((node) => nodeOf(node, draft, tally)),
        rights: [],
        ...(graph.contracts === undefined ? {} : { contracts: contractsOf(graph, tally) }),
    }
    const providers = [...new Set(rebuilt.nodes.flatMap((node) => node.uses.map((use) => use.provider)))].filter(
        (provider) => provider !== "brain",
    )
    const body: Omit<AgentTemplatePackage, "hash"> = {
        format: TEMPLATE_FORMAT,
        key: draft.key,
        version: draft.version,
        publisher: draft.publisher,
        baseModule: draft.baseModule,
        requiresPlugins: draft.requiresPlugins,
        listing: draft.listing,
        graph: rebuilt,
        parameters: draft.parameters,
        bindings: draft.bindings,
        proposedRights: graph.rights.map((right) => ({
            kind: right.kind,
            scope: right.scope,
            hide: [...right.hide],
            mask: [...right.mask],
        })),
        requiredProviders: providers,
        requiredAuthorityActions: requiredActionsOf(rebuilt),
        starterKnowledge: draft.starterKnowledge,
        persona: draft.persona,
    }
    const problems = [
        ...bindingProblems(rebuilt, draft),
        ...leakProblems({ ...body, publisher: null }, draft.forbidden),
    ]
    const report: PackageReport = {
        nodes: rebuilt.nodes.length,
        branches: rebuilt.nodes.reduce((sum, node) => sum + (node.decide?.branches.length ?? 0), 0),
        brainRefs: tally.brainRefs,
        privateSources: tally.privateSources,
        people: tally.people,
        rights: graph.rights.length,
    }
    return {
        package: problems.length === 0 ? { ...body, hash: hashOfPackage(body) } : null,
        report,
        problems,
        suggestions: suggestionsOf(graph),
    }
}
