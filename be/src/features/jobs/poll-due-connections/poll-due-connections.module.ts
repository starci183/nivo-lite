import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./poll-due-connections.module-definition"
import { PollDueStep } from "./steps/poll-due.step"

@Module({ providers: [PollDueStep], exports: [PollDueStep] })
/** The application of the poll-due-connections job: its step; the queue transport module imports it. */
export class PollDueConnectionsModule extends ConfigurableModuleClass {}
