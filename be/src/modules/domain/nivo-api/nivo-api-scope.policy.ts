import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { ExposedNivoApiVerb } from "./nivo-api.declarations"
import type { NivoApiScope } from "./nivo-api-ops.contracts"
import { agentsAnswerSchema, namedIdsSchema, stopsAnswerSchema, type NamedIds } from "./nivo-api-scope.schema"

/**
 * What an agent-scoped key narrows on each exposed op: nothing (`data`: a NIVO data op runs by the holder's rights alone), the installation
 * it names, the installation and the run it names, the run it names, or the agents and stops it answers (the other agents' are left out).
 * Total over the exposed ops by type, so a new op states its narrowing.
 */
const NIVO_API_SCOPES: { readonly [V in ExposedNivoApiVerb]: NivoApiScope } = {
    [NIVO_API.contact.list]: "data",
    [NIVO_API.contact.get]: "data",
    [NIVO_API.contact.blockList]: "data",
    [NIVO_API.contact.update]: "data",
    [NIVO_API.contact.identityLink]: "data",
    [NIVO_API.contact.identityUnlink]: "data",
    [NIVO_API.contact.merge]: "data",
    [NIVO_API.contact.memoryForget]: "data",
    [NIVO_API.contact.delete]: "data",
    [NIVO_API.customerMessage.list]: "data",
    [NIVO_API.theme.get]: "data",
    [NIVO_API.theme.update]: "data",
    [NIVO_API.theme.reset]: "data",
    [NIVO_API.file.upload]: "data",
    [NIVO_API.file.confirm]: "data",
    [NIVO_API.file.link]: "data",
    [NIVO_API.file.get]: "data",
    [NIVO_API.file.delete]: "data",
    [NIVO_API.chatThread.list]: "data",
    [NIVO_API.chatThread.get]: "data",
    [NIVO_API.brain.search]: "data",
    [NIVO_API.workbench.read]: "data",
    [NIVO_API.workbench.action]: "data",
    [NIVO_API.record.typeList]: "data",
    [NIVO_API.accountData.typeList]: "data",
    [NIVO_API.accountData.rowList]: "data",
    [NIVO_API.agent.list]: "agents",
    [NIVO_API.agent.deletionImpact]: "installation",
    [NIVO_API.workflow.list]: "installation",
    [NIVO_API.workflow.get]: "installation",
    [NIVO_API.workflow.run]: "installation",
    [NIVO_API.run.list]: "installation",
    [NIVO_API.run.get]: "installation_run",
    [NIVO_API.stop.list]: "stops",
    [NIVO_API.stop.answer]: "run",
    [NIVO_API.run.stepDecide]: "installation_run",
}

/** The ids an agent op names, read from its validated arguments. */
export const namedIdsOf = (args: unknown): NamedIds => namedIdsSchema.parse(args)

/** The answer as an agent-scoped key sees it: the agents and stops of its own agent only (a stop page carries no workspace total). */
export const narrowedOf = (scope: NivoApiScope, data: unknown, agentId: string): unknown => {
    if (scope === "agents") {
        const answer = agentsAnswerSchema.parse(data)
        return { ...answer, agents: answer.agents.filter((agent) => agent.agentId === agentId) }
    }
    if (scope === "stops") {
        const { total: _total, ...answer } = stopsAnswerSchema.parse(data)
        return { ...answer, stops: answer.stops.filter((stop) => stop.agentId === agentId) }
    }
    return data
}

/** The key narrowings by op name. */
const SCOPES: ReadonlyMap<string, NivoApiScope> = new Map(Object.entries(NIVO_API_SCOPES))

/** What an agent-scoped key narrows on an exposed op; undefined for a name that is not one. */
export const scopeOf = (name: string): NivoApiScope | undefined => SCOPES.get(name)
