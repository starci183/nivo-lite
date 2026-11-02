import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./draft-public-document.module-definition"
import { DraftPublicDocumentStep } from "./steps/draft-public-document.step"

@Module({ providers: [DraftPublicDocumentStep], exports: [DraftPublicDocumentStep] })
/** The application of the draft-public-document job: its step; the queue transport module imports it. */
export class DraftPublicDocumentModule extends ConfigurableModuleClass {}
