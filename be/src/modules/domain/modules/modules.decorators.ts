import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ModulesOptions } from "./modules.options"

/** Token of the modules options, exported so a spec can provide it. */
export const MODULES_OPTIONS: unique symbol = Symbol("domain.modules.options")

/** Injects the options of the modules capability. Parameter type: ModulesOptions. */
export const InjectModulesOptions = (): TypedParameterDecorator<ModulesOptions> =>
    injector<ModulesOptions>(MODULES_OPTIONS)
