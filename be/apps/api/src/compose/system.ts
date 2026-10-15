import type { ModuleMetadata } from "@nestjs/common"
import { ModuleOpsModule } from "@modules/domain/module-ops"
import { systemCapabilities } from "./bindings"
import { G19_PORTS } from "./ports"
/** The system area of the API, in registration order. */
export const systemModules = (): NonNullable<ModuleMetadata["imports"]> => [
    ...systemCapabilities(),
    ModuleOpsModule.register({ isGlobal: true, ports: G19_PORTS.moduleOps }),
]
