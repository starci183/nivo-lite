import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./content-drafting.module-definition"
import { CompleteContentDraftHandler } from "./application/complete-content-draft.handler"

@Module({ providers: [CompleteContentDraftHandler] })
/** The content-drafting reactor: the handlers its consumers dispatch to. */
export class ContentDraftingModule extends ConfigurableModuleClass {}
