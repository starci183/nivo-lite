import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { HiringOptions } from "./hiring.options"

/** Token of the options of the hiring capability, exported so a spec can provide it. */
export const HIRING_OPTIONS: unique symbol = Symbol("domain.hiring.options")

/** Injects the options of the hiring capability. Parameter type: HiringOptions. */
export const InjectHiringOptions = (): TypedParameterDecorator<HiringOptions> => injector<HiringOptions>(HIRING_OPTIONS)
