import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentRegistryService } from "./agent-registry.service"
import type { GatewayClient, GatewaySocketFactory } from "./gateway.client"
import type { OpenclawFiles } from "./openclaw-files.port"
import type { OpenclawOptions } from "./openclaw.options"
import type { WorkspaceWriterService } from "./workspace-writer.service"

/** Token of the OpenClaw options, exported so a spec can provide it. */
export const OPENCLAW_OPTIONS: unique symbol = Symbol("integrations.openclaw.options")

/** Token of the factory that opens a gateway socket. */
export const OPENCLAW_SOCKET_FACTORY: unique symbol = Symbol("integrations.openclaw.socket-factory")

/** Token of the file system port. */
export const OPENCLAW_FILES: unique symbol = Symbol("integrations.openclaw.files")

/** Injects the OpenClaw options. Parameter type: OpenclawOptions. */
export const InjectOpenclawOptions = (): TypedParameterDecorator<OpenclawOptions> =>
    injector<OpenclawOptions>(OPENCLAW_OPTIONS)

/** Injects the gateway socket factory. Parameter type: GatewaySocketFactory. */
export const InjectOpenclawSocketFactory = (): TypedParameterDecorator<GatewaySocketFactory> =>
    injector<GatewaySocketFactory>(OPENCLAW_SOCKET_FACTORY)

/** Injects the file system port. Parameter type: OpenclawFiles. */
export const InjectOpenclawFiles = (): TypedParameterDecorator<OpenclawFiles> => injector<OpenclawFiles>(OPENCLAW_FILES)

/** Token of the gateway client, for the capabilities that run a turn. */
export const OPENCLAW_GATEWAY: unique symbol = Symbol("integrations.openclaw.gateway")

/** Token of the agent registry, for the capabilities that register agents. */
export const OPENCLAW_AGENT_REGISTRY: unique symbol = Symbol("integrations.openclaw.agent-registry")

/** Token of the workspace writer, for the capabilities that sync agent bundles. */
export const OPENCLAW_WORKSPACE_WRITER: unique symbol = Symbol("integrations.openclaw.workspace-writer")

/** Injects the gateway client. Parameter type: GatewayClient. */
export const InjectOpenclawGateway = (): TypedParameterDecorator<GatewayClient> =>
    injector<GatewayClient>(OPENCLAW_GATEWAY)

/** Injects the agent registry. Parameter type: AgentRegistryService. */
export const InjectOpenclawAgentRegistry = (): TypedParameterDecorator<AgentRegistryService> =>
    injector<AgentRegistryService>(OPENCLAW_AGENT_REGISTRY)

/** Injects the workspace writer. Parameter type: WorkspaceWriterService. */
export const InjectOpenclawWorkspaceWriter = (): TypedParameterDecorator<WorkspaceWriterService> =>
    injector<WorkspaceWriterService>(OPENCLAW_WORKSPACE_WRITER)
