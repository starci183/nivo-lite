import type { DynamicModule } from "@nestjs/common"
import { systemCapabilities } from "./bindings"
/** The system area of the API, in registration order. */
export const systemModules = (): Array<DynamicModule> => [
    ...systemCapabilities(),
]
