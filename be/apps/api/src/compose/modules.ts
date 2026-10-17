import type { DynamicModule } from "@nestjs/common"
import { ModulesGraphqlModule } from "@features/api/modules"
import { ApiKeysModule } from "@modules/domain/api-keys"
import { OverviewModule } from "@modules/domain/overview"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule } from "@modules/domain/modules"
import { PublicApiModule } from "@modules/domain/public-api"
/** The modules area of the API, in registration order. */
export const modulesModules = (): Array<DynamicModule> => [
    ModulesModule.register({ isGlobal: true, categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }),
    ModulesGraphqlModule.register({}),
    ApiKeysModule.register({ isGlobal: true }),
    OverviewModule.register({ isGlobal: true }),
    PublicApiModule.register({ isGlobal: true }),
]
