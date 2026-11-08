import { ModulesContainer } from "@nestjs/core"
import { injector, type TypedParameterDecorator } from "@modules/platform/composition"

/** Injects the container that holds every module of the app. Parameter type: ModulesContainer. */
export const InjectModulesContainer = (): TypedParameterDecorator<ModulesContainer> =>
    injector<ModulesContainer>(ModulesContainer)
