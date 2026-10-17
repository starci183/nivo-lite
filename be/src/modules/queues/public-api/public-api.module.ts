import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./public-api.module-definition"
import { PublicApiQueue } from "./public-api.queue"

@Module({ providers: [PublicApiQueue], exports: [PublicApiQueue] })
/** The public-api queue: its typed producer, imported by the domain module whose service enqueues. */
export class PublicApiQueueModule extends ConfigurableModuleClass {}
