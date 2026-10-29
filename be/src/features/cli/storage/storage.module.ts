import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./storage.module-definition"
import { StorageCli } from "./storage.cli"
import { BootstrapStorageCli } from "./subs/bootstrap.cli"

@Module({ providers: [StorageCli, BootstrapStorageCli] })
/** The storage group: bucket set-up; the storage integration is composed by the cli app. */
export class StorageCliModule extends ConfigurableModuleClass {}
