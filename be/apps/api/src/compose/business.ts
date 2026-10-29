import type { DynamicModule } from "@nestjs/common"
import { INVENTORY_ERROR_KINDS, INVENTORY_MESSAGES, InventoryModule } from "@modules/domain/inventory"
import { SHIFTS_ERROR_KINDS, SHIFTS_MESSAGES, ShiftsModule } from "@modules/domain/shifts"
import { HIRING_ERROR_KINDS, HIRING_MESSAGES, HiringModule } from "@modules/domain/hiring"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The business area of the API, in registration order. */
export const businessModules = (options: ApiOptions): Array<DynamicModule> => [
    InventoryModule.register({ isGlobal: true }),
    ShiftsModule.register({ isGlobal: true }),
    HiringModule.register({ isGlobal: true, ...options.channels }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const businessErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    INVENTORY_ERROR_KINDS,
    SHIFTS_ERROR_KINDS,
    HIRING_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const businessMessages: ReadonlyArray<MessageBundle> = [INVENTORY_MESSAGES, SHIFTS_MESSAGES, HIRING_MESSAGES]
