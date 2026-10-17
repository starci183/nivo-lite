import { MODULE_OPS_PORTS } from "../api.options"
import type { DynamicModule } from "@nestjs/common"
import { ModuleOpsModule } from "@modules/domain/module-ops"
import { systemCapabilities } from "./bindings"
/** The system area of the API, in registration order. */
export const systemModules = (): Array<DynamicModule> => [
    ...systemCapabilities(),
    ModuleOpsModule.register({ isGlobal: true, ports: MODULE_OPS_PORTS }),
]
