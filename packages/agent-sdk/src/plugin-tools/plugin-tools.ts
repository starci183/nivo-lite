import type { PortProvider, RunContext } from "../port/port.types"
import { DEFAULT_TIME_ZONE } from "../port/time-zone"
import { defineServiceContract } from "../service/service"
import type { ServiceContract, ServiceDefinition } from "../service/service.types"
import type { PluginToolDeclarations, PluginTools } from "./plugin-tools.types"

/** The contract of the tools a plugin serves: their business (the engine resolves it for the agent of the module that ships them). */
export const PLUGIN_TOOLS: ServiceContract<PluginTools> = defineServiceContract<PluginTools>("engine.plugin-tools")

/** The contract of the same tools' declarations: static data, so the engine lists them at boot with no workspace and no port. */
export const PLUGIN_TOOL_DECLARATIONS: ServiceContract<PluginToolDeclarations> =
    defineServiceContract<PluginToolDeclarations>("engine.plugin-tool-declarations")

/** A provider of no port: a declarations service names none. */
const NO_PORTS: PortProvider = {
    implementationOf: () => {
        throw new Error("a plugin tool declarations service asks for no port")
    },
}

/** The context a declarations service is built with: it reads none of it. */
const STATIC_CONTEXT: RunContext = {
    workspaceId: "",
    memberId: null,
    now: new Date(0),
    timeZone: DEFAULT_TIME_ZONE,
    locale: "vi",
}

/** The declarations of an installed declarations service (built with no port: `build` is pure of ambient state). */
export const declarationsOf = (definition: ServiceDefinition<PluginToolDeclarations>): PluginToolDeclarations =>
    definition.construct(NO_PORTS, STATIC_CONTEXT)
