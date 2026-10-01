import { DynamicModule, Module } from "@nestjs/common";
import { JobQueueService } from "./job-queue.service";
import type { QueueOptions } from "./queue.config";
import { QUEUE_OPTIONS } from "./queue.types";

@Module({})
export class QueueModule {
  static register(options: QueueOptions): DynamicModule {
    return {
      module: QueueModule,
      providers: [{ provide: QUEUE_OPTIONS, useValue: options }, JobQueueService],
      exports: [QUEUE_OPTIONS, JobQueueService],
    };
  }
}
