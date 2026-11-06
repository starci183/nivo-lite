import { Module } from "@nestjs/common"
import { ModuleJobsQueue } from "@modules/queues/module-jobs"

@Module({ providers: [ModuleJobsQueue], exports: [ModuleJobsQueue] })
/** The producer of the module jobs an approval opens its card through: the engine gives it to the api, and the approval worlds run without the engine. */
export class OfficeChainQueueProofModule {}
