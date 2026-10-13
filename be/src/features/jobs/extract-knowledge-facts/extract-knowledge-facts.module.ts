import { Module } from "@nestjs/common"
import { ExtractFactsStep } from "./steps/extract-facts.step"

@Module({ providers: [ExtractFactsStep], exports: [ExtractFactsStep] })
/** The application of the extract-knowledge-facts job: its step; the queue transport module imports it. */
export class ExtractKnowledgeFactsModule {}
