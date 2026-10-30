import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./storage.module-definition"
import { S3StorageClient } from "./storage.client"
import {
    S3_CLIENT,
    STORAGE_ASSETS,
    STORAGE_CLIENT,
    STORAGE_OBJECTS,
    STORAGE_OPTIONS,
    STORAGE_SIGNER,
} from "./storage.decorators"
import { createS3Client, createStorageSigner } from "./s3.client"
import { StorageAssetsService } from "./object-storage-assets.service"
import { StorageBootstrapService } from "./object-storage-bootstrap.service"
import { StorageObjectsService } from "./object-storage-objects.service"

@Module({})
/** The object storage integration: the S3 client of MinIO and the objects and files services domains reach it through. */
export class ObjectStorageModule extends ConfigurableModuleClass {
    /** Registers the integration once per app with the options parsed at the composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: STORAGE_OPTIONS, useValue: options },
                { provide: S3_CLIENT, useValue: createS3Client(options, options.endpoint) },
                { provide: STORAGE_SIGNER, useValue: createStorageSigner(options) },
                { provide: STORAGE_CLIENT, useClass: S3StorageClient },
                { provide: STORAGE_OBJECTS, useClass: StorageObjectsService },
                { provide: STORAGE_ASSETS, useClass: StorageAssetsService },
                StorageBootstrapService,
            ],
            exports: [STORAGE_OBJECTS, STORAGE_ASSETS, StorageBootstrapService],
        }
    }
}
