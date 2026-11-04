import { ModulesContainer } from "@nestjs/core"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"

/** Injects the container that holds every module of the app. Parameter type: ModulesContainer. */
export const InjectModulesContainer = (): TypedParameterDecorator<ModulesContainer> =>
    injector<ModulesContainer>(ModulesContainer)
