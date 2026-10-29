import type { DynamicModule } from "@nestjs/common"
import { ModulesGraphqlModule } from "@features/api/modules"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import { OverviewModule } from "@modules/domain/overview"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule } from "@modules/domain/modules"
import { PUBLIC_API_ERROR_KINDS, PUBLIC_API_MESSAGES, PublicApiModule } from "@modules/domain/public-api"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The modules area of the API, in registration order. */
export const modulesModules = (): Array<DynamicModule> => [
    ModulesModule.register({ isGlobal: true, categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }),
    ModulesGraphqlModule.register({}),
    ApiKeysModule.register({ isGlobal: true }),
    OverviewModule.register({ isGlobal: true }),
    PublicApiModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const modulesErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    API_KEYS_ERROR_KINDS,
    PUBLIC_API_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const modulesMessages: ReadonlyArray<MessageBundle> = [API_KEYS_MESSAGES, PUBLIC_API_MESSAGES]
