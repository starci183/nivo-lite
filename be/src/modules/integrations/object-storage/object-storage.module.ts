import { ObjectStorageModule as StorageModule } from "@starci/object-storage"
import type { ObjectStorageOptions as StorageSettings } from "@starci/object-storage"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./object-storage.module-definition"
import { STORAGE_ASSETS, STORAGE_OBJECTS, STORAGE_OPTIONS } from "./object-storage.decorators"
import type { ObjectStorageOptions } from "./object-storage.options"
import { StorageAssetsService } from "./object-storage-assets.service"
import { StorageBootstrapService } from "./object-storage-bootstrap.service"
import { StorageObjectsService } from "./object-storage-objects.service"

/** The settings of `@starci/object-storage` for the parsed options of the app and its clock. */
const settingsOf = (options: ObjectStorageOptions, clock: Clock): StorageSettings => ({
    endpoint: options.endpoint,
    publicEndpoint: options.publicUrl,
    region: options.region,
    accessKeyId: options.accessKey,
    secretAccessKey: options.secretKey,
    timeoutMs: options.timeoutMs,
    clock,
})

@Module({})
/** The object storage integration: `@starci/object-storage` composed with the app's settings, and the objects and files services domains reach it through. */
export class ObjectStorageModule extends ConfigurableModuleClass {
    /** Registers the integration once per app with the options parsed at the composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const storage = StorageModule.registerAsync({
            inject: [CLOCK],
            useFactory: (clock: Clock): StorageSettings => settingsOf(options, clock),
        })
        return {
            ...base,
            imports: [...(base.imports ?? []), storage],
            providers: [
                ...(base.providers ?? []),
                { provide: STORAGE_OPTIONS, useValue: options },
                { provide: STORAGE_OBJECTS, useClass: StorageObjectsService },
                { provide: STORAGE_ASSETS, useClass: StorageAssetsService },
                StorageBootstrapService,
            ],
            exports: [STORAGE_OBJECTS, STORAGE_ASSETS, StorageBootstrapService],
        }
    }
}
