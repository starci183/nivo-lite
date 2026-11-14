import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import {
    ToolRegistryService,
    argsHashOf,
    domainNameIn,
    toolArgumentsSchema,
    toolNameOf,
    type ToolCaller,
    type WorkspaceToolFamily,
} from "@modules/domain/tools"
import type { EngineDoorProvider } from "@modules/domain/entity-engine"
import { isDomainTool, type DoorApi, type DoorCallResult } from "@nivo-lite/agent-sdk/mutation"
import { doorResultOf, gatewayNameOf, opKeyOf } from "./door-call.policy"
import { NIVO_AGENT_MODULE, NOT_GRANTED, NO_SPEAKER, isDoorGranted, isSpokenAsModuleAgent } from "./door-grants.policy"
import type { DoorBinding } from "./entity-engine-door.contracts"
import { EntityEngineDoorError, EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"

/** The answer for a call the door cannot even send. */
const invalid = (message: string): DoorCallResult => ({ ok: false, reason: "invalid", message })

/** The answer for a domain tool no connection of the workspace plays. */
const NO_PROVIDER: DoorCallResult = { ok: false, reason: "unknown_tool", message: "no_provider" }

/** The full name a door tool resolves to among the families: the tool of a connection that plays the domain tool, else the tool whose own full name it is (an installed effect). */
const nameOf = (families: ReadonlyArray<WorkspaceToolFamily>, tool: string): string | null =>
    domainNameIn(families, tool) ??
    (families.some((family) => family.manifest.tools.some((spec) => toolNameOf(family.manifest, spec.name) === tool))
        ? tool
        : null)

@Injectable()
/**
 * The provider of the `engine.door` port: a declared job calls a door tool (`<group>.<provider>.<action>`) and the call goes through
 * the NIVO MCP gateway, so the agent grant, the data rights, the approval rule and the credentials of the workspace connection decide
 * it, exactly as for an agent; the job holds only the tools of `DOOR_GRANTS` (default deny, answered `forbidden` before the
 * gateway is reached): as the internal agent (the seeded `nivo` row of the workspace), except a tool that is an agent's own voice (the customer send), which it calls as the installed agent of its own module and with the business key it names (`onceBy`). The call is never made while an engine scope is open (no transaction spans an external call,
 * BE-PERSISTENCE-6), and its replay key is the job's effect key joined to the hash of the arguments, so a retried job never repeats
 * an effect. A domain tool (`<group>.<action>`, `nivo.tool.team-chat.report.post`) names no provider: the door resolves it to the tool of the workspace's own
 * connection that plays it (`domainNameIn` over the connectors of the workspace), and answers `unknown_tool` when the workspace has none.
 */
export class EngineDoorService implements EngineDoorProvider {
    constructor(
        private readonly gateway: ToolRegistryService,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** The seeded `nivo` agent of the workspace; the workspace row laid it down, so a missing one is a defect and nothing is created here. */
    private async nivoAgentOf(workspaceId: string): Promise<string> {
        const [agentId] = await this.agents.idsOfModule(workspaceId, NIVO_AGENT_MODULE, 1)
        if (agentId === undefined)
            throw new EntityEngineDoorError({ code: EntityEngineDoorErrorCode.NoAgent, params: { workspaceId } })
        return agentId
    }

    /** The `engine.door` handle of one job run. */
    doorApi(binding: DoorBinding): DoorApi {
        return {
            call: async (tool, input, options) => {
                if (binding.scopeOpen())
                    throw new EntityEngineDoorError({ code: EntityEngineDoorErrorCode.InScope, params: { tool } })
                if (!isDoorGranted(tool)) return NOT_GRANTED
                const args = toolArgumentsSchema.safeParse(input)
                if (!args.success) return invalid("invalid_arguments")
                const speaker = isSpokenAsModuleAgent(tool) ? binding.agentId : undefined
                if (isSpokenAsModuleAgent(tool) && speaker === undefined) return NO_SPEAKER
                const caller: ToolCaller = {
                    workspaceId: binding.workspaceId,
                    agentId: speaker ?? (await this.nivoAgentOf(binding.workspaceId)),
                    conversationId: options?.routeId ?? null,
                    workItemId: null,
                    audience: "internal",
                    engine: true,
                    origin: "engine_job",
                    opKey: opKeyOf(binding.effectKey, tool, argsHashOf(args.data)),
                    turnId: binding.jobId,
                    ...(options?.onceBy === undefined ? {} : { onceBy: options.onceBy }),
                    ...(options?.byMember === undefined ? {} : { byMember: options.byMember }),
                }
                const name = isDomainTool(tool) ? nameOf(this.gateway.familiesOf(), tool) : gatewayNameOf(tool)
                if (name === null) return NO_PROVIDER
                return doorResultOf(await this.gateway.call(caller, name, args.data))
            },
        }
    }
}
