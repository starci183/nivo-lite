import { Injectable } from "@nestjs/common"
import { McpGatewayService, argsHashOf, domainNameIn, gatewayArgumentsSchema } from "@modules/domain/mcp-gateway"
import type { GatewayCaller } from "@modules/domain/mcp-gateway"
import { agentIdFor } from "@modules/integrations/openclaw"
import { isDomainTool } from "@nivo-lite/agent-sdk/mutation"
import type { DoorApi, DoorCallResult } from "@nivo-lite/agent-sdk/mutation"
import { doorResultOf, gatewayNameOf, opKeyOf } from "./door-call.policy"
import { NOT_GRANTED, isDoorGranted } from "./door-grants.policy"
import type { DoorBinding } from "./entity-engine-door.contracts"
import { InjectEntityEngineDoorOptions } from "./entity-engine-door.decorators"
import type { EntityEngineDoorOptions } from "./entity-engine-door.options"
import { EntityEngineDoorError, EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"

/** The answer for a call the door cannot even send. */
const invalid = (message: string): DoorCallResult => ({ ok: false, reason: "invalid", message })

/** The answer for a domain tool no connection of the workspace plays. */
const NO_PROVIDER: DoorCallResult = { ok: false, reason: "unknown_tool", message: "no_provider" }

@Injectable()
/**
 * The provider of the `engine.door` port: a declared job calls a door tool (`<group>.<provider>.<action>`) and the call goes through
 * the NIVO MCP gateway, so the agent grant, the data rights, the approval rule and the credentials of the workspace connection decide
 * it, exactly as for an agent; the internal agent holds only the tools of `DOOR_GRANTS` (default deny, answered `forbidden` before the
 * gateway is reached). The call is never made while an engine scope is open (no transaction spans an external call,
 * BE-PERSISTENCE-6), and its replay key is the job's effect key joined to the hash of the arguments, so a retried job never repeats
 * an effect. A domain tool (`<group>.<action>`, `chat.send`) names no provider: the door resolves it to the tool of the workspace's own
 * connection that plays it (`domainNameIn` over the connectors of the workspace), and answers `unknown_tool` when the workspace has none.
 */
export class EngineDoorService {
    constructor(
        private readonly gateway: McpGatewayService,
        @InjectEntityEngineDoorOptions() private readonly options: EntityEngineDoorOptions,
    ) {}

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
                    agentId: agentIdFor(binding.workspaceId, this.options.agentModule),
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
