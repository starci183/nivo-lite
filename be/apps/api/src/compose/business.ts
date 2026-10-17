import type { DynamicModule } from "@nestjs/common"
import { InventoryModule } from "@modules/domain/inventory"
import { ShiftsModule } from "@modules/domain/shifts"
import { HiringModule } from "@modules/domain/hiring"
import type { ApiOptions } from "../api.options"
/** The business area of the API, in registration order. */
export const businessModules = (options: ApiOptions): Array<DynamicModule> => [
    InventoryModule.register({ isGlobal: true }),
    ShiftsModule.register({ isGlobal: true }),
    HiringModule.register({ isGlobal: true, ...options.channels }),
]
