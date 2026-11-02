import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DraftPublicDocumentQueueOptions } from "./draft-public-document-queue.options"

/** The configurable-module base of the draft-public-document-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DraftPublicDocumentQueueOptions>().setClassMethodName("register").build()
