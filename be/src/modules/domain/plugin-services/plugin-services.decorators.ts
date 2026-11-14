import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { PluginServicePorts } from "./plugin-services.contracts"
import type { PluginServicesOptions } from "./plugin-services.options"
import type { PluginServicesService } from "./plugin-services.service"

/** Token of the plugin services options, exported so a spec can provide it. */
export const PLUGIN_SERVICES_OPTIONS: unique symbol = Symbol("domain.plugin-services.options")

/** Injects the options of the plugin services. Parameter type: PluginServicesOptions. */
export const InjectPluginServicesOptions = (): TypedParameterDecorator<PluginServicesOptions> =>
    injector<PluginServicesOptions>(PLUGIN_SERVICES_OPTIONS)

/** Token of the plugin services themselves, for a capability that reaches them without importing the class (the class pulls the door's whole graph, which may lead back to the capability). */
export const PLUGIN_SERVICES: unique symbol = Symbol("domain.plugin-services.service")

/** What a capability takes of the plugin services through the token: the whole service. */
export type PluginServicesApi = PluginServicesService

/** Injects the plugin services by token. Parameter type: PluginServicesApi. */
export const InjectPluginServices = (): TypedParameterDecorator<PluginServicesApi> => injector<PluginServicesApi>(PLUGIN_SERVICES)

/** Token of the port host the plugin services build a service over; the composition root binds it where the workbench door is registered. */
export const PLUGIN_SERVICE_PORTS: unique symbol = Symbol("domain.plugin-services.ports")

/** Injects the port host of the plugin services. Parameter type: PluginServicePorts. */
export const InjectPluginServicePorts = (): TypedParameterDecorator<PluginServicePorts> => injector<PluginServicePorts>(PLUGIN_SERVICE_PORTS)
