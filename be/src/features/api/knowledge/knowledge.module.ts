import { Module } from "@nestjs/common"
import { AddSourceHandler } from "./application/add-source.handler"
import { AskKnowledgeHandler } from "./application/ask-knowledge.handler"
import { CreateUploadHandler } from "./application/create-upload.handler"
import { ListLinkedFolderHandler } from "./application/list-linked-folder.handler"
import { ListPickedFolderHandler } from "./application/list-picked-folder.handler"
import { ReindexSourceHandler } from "./application/reindex-source.handler"
import { RequestReembedHandler } from "./application/request-reembed.handler"
import { RetrySourceHandler } from "./application/retry-source.handler"
import { UpdateSourceHandler } from "./application/update-source.handler"

@Module({
    providers: [
        AddSourceHandler,
        AskKnowledgeHandler,
        CreateUploadHandler,
        ListLinkedFolderHandler,
        ListPickedFolderHandler,
        ReindexSourceHandler,
        RequestReembedHandler,
        RetrySourceHandler,
        UpdateSourceHandler,
    ],
})
/** The knowledge feature: the handlers of its application. */
export class KnowledgeApiModule {}
