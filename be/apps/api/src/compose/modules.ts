import type { DynamicModule } from "@nestjs/common"
import { WorkItemsService } from "@modules/domain/work-items"
import { ModulesGraphqlModule } from "@features/api/modules"
import { WorkbenchGraphqlModule } from "@features/api/workbench"
import { ProviderOfferGraphqlModule } from "@features/api/provider-offer"
import { ProviderTriggersGraphqlModule } from "@features/api/provider-triggers"
import { NodeRightsGraphqlModule } from "@features/api/node-rights"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule, type ApiKeysOptions } from "@modules/domain/api-keys"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule } from "@modules/domain/modules"
import { PlatformPortsModule } from "@modules/domain/platform-ports"
import {
    PLUGIN_SERVICES_ERROR_KINDS,
    PLUGIN_SERVICES_MESSAGES,
    PluginServicesModule,
} from "@modules/domain/plugin-services"
import {
    PROVIDER_OFFER_ERROR_KINDS,
    PROVIDER_OFFER_MESSAGES,
    ProviderOfferModule,
} from "@modules/domain/provider-offer"
import { PROVIDER_TRIGGERS_ERROR_KINDS, PROVIDER_TRIGGERS_MESSAGES } from "@modules/domain/provider-triggers"
import {
    NODE_RIGHT_ROLLUPS_ERROR_KINDS,
    NODE_RIGHT_ROLLUPS_MESSAGES,
    NodeRightRollupsModule,
    NodeRightRollupsService,
} from "@modules/domain/node-right-rollups"
import { PUBLIC_API_ERROR_KINDS, PUBLIC_API_MESSAGES, PublicApiModule } from "@modules/domain/public-api"
import { RECORD_FILES_ERROR_KINDS, RECORD_FILES_MESSAGES, RecordFilesModule } from "@modules/domain/record-files"
import { STORAGE_FILES } from "@modules/integrations/object-storage"
import {
    WORKBENCH_DOOR_ERROR_KINDS,
    WORKBENCH_DOOR_MESSAGES,
    WorkbenchDoorModule,
} from "@modules/domain/workbench-door"
import { INSTALLED, INSTALLED_MODULES, INSTALLED_REGISTRY_HASH } from "@modules/domain/installed-plugins"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The modules area of the API, in registration order. */
export const modulesModules = (apiKeys: ApiKeysOptions): Array<DynamicModule> => [
    ModulesModule.register({
        isGlobal: true,
        categories: MODULE_CATEGORIES,
        catalog: MODULE_CATALOG,
        // The capabilities that keep records naming an installation; each is an existing provider of the app.
        ports: {
            recordSources: [WorkItemsService],
        },
    }),
    ModulesGraphqlModule.register({}),
    ApiKeysModule.register({ isGlobal: true, ...apiKeys }),
    PublicApiModule.register({ isGlobal: true }),
    WorkbenchGraphqlModule.register({}),
    WorkbenchDoorModule.register({
        isGlobal: true,
        modules: INSTALLED_MODULES,
        entities: INSTALLED.entities(),
        registryHash: INSTALLED_REGISTRY_HASH,
    }),
    // The services the installed plugins ship, built for one agent: the engine never imports a plugin.
    PluginServicesModule.register({ isGlobal: true, catalog: INSTALLED }),
    // The one file store of the records (BIZ-MOVE G3): the door's file calls and the file tools of nodes, over the records bucket.
    RecordFilesModule.register({ isGlobal: true, storage: STORAGE_FILES }),
    // The desk's reach reads the node-rights roll-up, bound here: the roll-up reaches the door through the provider offer.
    PlatformPortsModule.register({ isGlobal: true, rightsRollup: NodeRightRollupsService }),
    ProviderOfferModule.register({ isGlobal: true }),
    ProviderOfferGraphqlModule.register({}),
    ProviderTriggersGraphqlModule.register({}),
    NodeRightRollupsModule.register({ isGlobal: true }),
    NodeRightsGraphqlModule.register({}),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const modulesErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    API_KEYS_ERROR_KINDS,
    PUBLIC_API_ERROR_KINDS,
    WORKBENCH_DOOR_ERROR_KINDS,
    PLUGIN_SERVICES_ERROR_KINDS,
    RECORD_FILES_ERROR_KINDS,
    PROVIDER_OFFER_ERROR_KINDS,
    PROVIDER_TRIGGERS_ERROR_KINDS,
    NODE_RIGHT_ROLLUPS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const modulesMessages: ReadonlyArray<MessageBundle> = [
    API_KEYS_MESSAGES,
    PUBLIC_API_MESSAGES,
    WORKBENCH_DOOR_MESSAGES,
    PLUGIN_SERVICES_MESSAGES,
    RECORD_FILES_MESSAGES,
    PROVIDER_OFFER_MESSAGES,
    PROVIDER_TRIGGERS_MESSAGES,
    NODE_RIGHT_ROLLUPS_MESSAGES,
]
