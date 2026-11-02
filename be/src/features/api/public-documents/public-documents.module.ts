import { Module } from "@nestjs/common"
import { ApprovePublicDocumentHandler } from "./application/approve-public-document.handler"
import { ArchivePublicDocumentHandler } from "./application/archive-public-document.handler"
import { DraftPublicDocumentHandler } from "./application/draft-public-document.handler"
import { PublicDocumentsHandler } from "./application/public-documents.handler"
import { RedraftPublicDocumentHandler } from "./application/redraft-public-document.handler"
import { UpdatePublicDocumentHandler } from "./application/update-public-document.handler"
import { WritePublicDocumentHandler } from "./application/write-public-document.handler"
import { ConfigurableModuleClass } from "./public-documents.module-definition"
import { BrainTodoHandler } from "./application/brain-todo.handler"

@Module({
    providers: [
        PublicDocumentsHandler,
        DraftPublicDocumentHandler,
        WritePublicDocumentHandler,
        UpdatePublicDocumentHandler,
        RedraftPublicDocumentHandler,
        ApprovePublicDocumentHandler,
        ArchivePublicDocumentHandler,
        BrainTodoHandler,
    ],
})
/** The public-documents feature: the handlers of its application. */
export class PublicDocumentsApiModule extends ConfigurableModuleClass {}
