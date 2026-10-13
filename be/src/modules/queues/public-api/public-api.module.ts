import { Module } from "@nestjs/common"
import { PublicApiQueue } from "./public-api.queue"

@Module({ providers: [PublicApiQueue], exports: [PublicApiQueue] })
/** The public-api queue: its typed producer, imported by the domain module whose service enqueues. */
export class PublicApiQueueModule {}
