import { Module } from "@nestjs/common"
import { PublicDocumentsApiModule } from "../../public-documents.module"
import { ApprovePublicDocumentResolver } from "./approve-public-document.resolver"
import { ArchivePublicDocumentResolver } from "./archive-public-document.resolver"
import { DraftPublicDocumentResolver } from "./draft-public-document.resolver"
import { PublicDocumentsResolver } from "./public-documents.resolver"
import { ConfigurableModuleClass } from "./public-documents-graphql.module-definition"
import { RedraftPublicDocumentResolver } from "./redraft-public-document.resolver"
import { UpdatePublicDocumentResolver } from "./update-public-document.resolver"
import { WritePublicDocumentResolver } from "./write-public-document.resolver"
import { BrainTodoResolver } from "./brain-todo.resolver"

@Module({
    imports: [PublicDocumentsApiModule.register({})],
    providers: [
        PublicDocumentsResolver,
        DraftPublicDocumentResolver,
        WritePublicDocumentResolver,
        UpdatePublicDocumentResolver,
        RedraftPublicDocumentResolver,
        ApprovePublicDocumentResolver,
        ArchivePublicDocumentResolver,
        BrainTodoResolver,
    ],
})
/** The GraphQL transport of the public-documents feature. */
export class PublicDocumentsGraphqlModule extends ConfigurableModuleClass {}
