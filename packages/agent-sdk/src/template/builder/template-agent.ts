import { VERB_SHARED_REFUSED, sharedVerbProblems } from "./agent-trigger-verbs"
import type { TemplateAgent, TemplateAgentConfig } from "./graph-builder.types"
import { type TemplateGraphContext, templateGraphProblems } from "./graph-problems"
import { duplicatesOf } from "./template-node"
import { type TemplateProblem, refuseProblems } from "./template-problems"

/** The engine's lookups a save passes on to every graph of the agent. */
export type TemplateAgentLookups = Pick<TemplateGraphContext, "tools" | "triggers">

/**
 * The problems of a template agent: `primary` naming no graph, two graphs of one key, a provider listed twice, a graph outside the agent's
 * module, one trigger verb shared by several graphs without disjoint exact conditions (`TRIGGER_VERB_SHARED`, while
 * `VERB_SHARED_REFUSED`), and every graph judged with the agent's providers (`NODE_ACCOUNT_NOT_OF_AGENT`,
 * `TRIGGER_PROVIDER_NOT_OF_AGENT`) and, when given, the engine's lookups. `at` of a graph's problem is prefixed with its key.
 */
export const templateAgentProblems = (
    agent: TemplateAgentConfig,
    lookups: TemplateAgentLookups = {},
): ReadonlyArray<TemplateProblem> => {
    const keys = agent.graphs.map((graph) => graph.key)
    return [
        ...(keys.includes(agent.primary)
            ? []
            : [{ code: "AGENT_PRIMARY_UNKNOWN" as const, at: `${agent.key}.primary` }]),
        ...duplicatesOf(keys).map((key): TemplateProblem => ({
            code: "AGENT_GRAPH_DUPLICATE",
            at: `${agent.key}.graphs.${key}`,
        })),
        ...duplicatesOf(agent.accounts).map((provider): TemplateProblem => ({
            code: "AGENT_ACCOUNT_DUPLICATE",
            at: `${agent.key}.accounts.${provider}`,
        })),
        ...agent.graphs
            .filter((graph) => graph.spec.moduleKey !== agent.key)
            .map((graph): TemplateProblem => ({ code: "AGENT_GRAPH_OUTSIDE", at: `${agent.key}.graphs.${graph.key}` })),
        ...(VERB_SHARED_REFUSED ? sharedVerbProblems(agent) : []),
        ...agent.graphs.flatMap((graph) =>
            templateGraphProblems(graph.spec, { nodes: graph.nodes, agentAccounts: agent.accounts, ...lookups }).map(
                (problem): TemplateProblem => ({ code: problem.code, at: `${graph.key}:${problem.at}` }),
            ),
        ),
    ]
}

/** Defines a template agent; throws `TemplateDefinitionError` at module load with every problem decidable without the engine. */
export const defineTemplateAgent = (config: TemplateAgentConfig): TemplateAgent => {
    refuseProblems(config.key, templateAgentProblems(config))
    return { ...config, entry: "template-agent" }
}
