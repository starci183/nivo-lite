import { Module } from "@nestjs/common"
import { IndexSourceStep } from "./steps/index-source.step"

@Module({ providers: [IndexSourceStep], exports: [IndexSourceStep] })
/** The application of the index-knowledge-source job: its step; the queue transport module imports it. */
export class IndexKnowledgeSourceModule {}
