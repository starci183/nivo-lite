import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { CommandReader } from "./office.port"

/** Token of the command reader port. */
export const COMMAND_READER: unique symbol = Symbol("domain.office.command-reader")

/** Injects the command reader. Parameter type: CommandReader. */
export const InjectCommandReader = (): TypedParameterDecorator<CommandReader> => injector<CommandReader>(COMMAND_READER)
