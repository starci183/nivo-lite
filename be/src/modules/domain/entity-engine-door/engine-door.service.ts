import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { McpGatewayService, argsHashOf, domainNameIn, gatewayArgumentsSchema } from "@modules/domain/mcp-gateway"
import type { GatewayCaller } from "@modules/domain/mcp-gateway"
import type { EngineDoorProvider } from "@modules/domain/entity-engine"
import { isDomainTool } from "@nivo-lite/agent-sdk/mutation"
import type { DoorApi, DoorCallResult } from "@nivo-lite/agent-sdk/mutation"
import { doorResultOf, gatewayNameOf, opKeyOf } from "./door-call.policy"
import { NIVO_AGENT_MODULE, NOT_GRANTED, isDoorGranted } from "./door-grants.policy"
import type { DoorBinding } from "./entity-engine-door.contracts"
import { EntityEngineDoorError, EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"

/** The answer for a call the door cannot even send. */
const invalid = (message: string): DoorCallResult => ({ ok: false, reason: "invalid", message })

/** The answer for a domain tool no connection of the workspace plays. */
const NO_PROVIDER: DoorCallResult = { ok: false, reason: "unknown_tool", message: "no_provider" }

@Injectable()
/**
 * The provider of the `engine.door` port: a declared job calls a door tool (`<group>.<provider>.<action>`) and the call goes through
 * the NIVO MCP gateway, so the agent grant, the data rights, the approval rule and the credentials of the workspace connection decide
 * it, exactly as for an agent; the internal agent (the seeded `nivo` row of the workspace) holds only the tools of `DOOR_GRANTS` (default deny, answered `forbidden` before the
 * gateway is reached). The call is never made while an engine scope is open (no transaction spans an external call,
 * BE-PERSISTENCE-6), and its replay key is the job's effect key joined to the hash of the arguments, so a retried job never repeats
 * an effect. A domain tool (`<group>.<action>`, `chat.send`) names no provider: the door resolves it to the tool of the workspace's own
 * connection that plays it (`domainNameIn` over the connectors of the workspace), and answers `unknown_tool` when the workspace has none.
 */
export class EngineDoorService implements EngineDoorProvider {
    constructor(
        private readonly gateway: McpGatewayService,
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
            call: async (tool, input) => {
                if (binding.scopeOpen())
                    throw new EntityEngineDoorError({ code: EntityEngineDoorErrorCode.InScope, params: { tool } })
                if (!isDoorGranted(tool)) return NOT_GRANTED
                const args = gatewayArgumentsSchema.safeParse(input)
                if (!args.success) return invalid("invalid_arguments")
                const caller: GatewayCaller = {
                    workspaceId: binding.workspaceId,
                    agentId: await this.nivoAgentOf(binding.workspaceId),
                    conversationId: null,
                    workItemId: null,
                    audience: "internal",
                    opKey: opKeyOf(binding.effectKey, tool, argsHashOf(args.data)),
                }
                const name = isDomainTool(tool)
                    ? domainNameIn(await this.gateway.connectorsOf(binding.workspaceId), tool)
                    : gatewayNameOf(tool)
                if (name === null) return NO_PROVIDER
                return doorResultOf(await this.gateway.call(caller, name, args.data))
            },
        }
    }
}
