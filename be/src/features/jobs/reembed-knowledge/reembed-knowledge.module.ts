import { Module } from "@nestjs/common"
import { ReembedStep } from "./steps/reembed.step"

@Module({ providers: [ReembedStep], exports: [ReembedStep] })
/** The application of the reembed-knowledge job: its step; the queue transport module imports it. */
export class ReembedKnowledgeModule {}
