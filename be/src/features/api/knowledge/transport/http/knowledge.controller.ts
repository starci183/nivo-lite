import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AddSourceCommand } from "../../application/add-source.command"
import { AskKnowledgeQuery } from "../../application/ask-knowledge.query"
import { CreateUploadCommand } from "../../application/create-upload.command"
import { DeleteSourceCommand } from "../../application/delete-source.command"
import { ListLinkedFolderQuery } from "../../application/list-linked-folder.query"
import { ListPickedFolderQuery } from "../../application/list-picked-folder.query"
import { ReindexSourceCommand } from "../../application/reindex-source.command"
import { RequestReembedCommand } from "../../application/request-reembed.command"
import { RetrySourceCommand } from "../../application/retry-source.command"
import { UpdateSourceCommand } from "../../application/update-source.command"
import { AddSourceRequest } from "./dto/add-source.request"
import { AskKnowledgeRequest } from "./dto/ask-knowledge.request"
import { CreateUploadRequest } from "./dto/create-upload.request"
import { FolderResponse, PickedFolderResponse } from "./dto/folder.response"
import { LinkedFolderRequest } from "./dto/linked-folder.request"
import { PassageResponse } from "./dto/passage.response"
import { PickedFolderRequest } from "./dto/picked-folder.request"
import { ReindexSourceRequest } from "./dto/reindex-source.request"
import { SourceIdRequest } from "./dto/source-id.request"
import { SourceRefResponse } from "./dto/source-ref.response"
import { UpdateSourceRequest } from "./dto/update-source.request"
import { UploadAddressResponse } from "./dto/upload-address.response"
import {
    toAddSourceRequest,
    toAskKnowledgeRequest,
    toFolderResponse,
    toPassagesResponse,
    toPickedFolderResponse,
    toReindexSourceRequest,
    toSourceRefResponse,
    toUpdateSourceRequest,
    toUploadAddressResponse,
} from "./knowledge.mapper"

@Controller("knowledge")
/** HTTP doors of the documents of the requested workspace; the services admit owner and manager, and any member may try a question. */
export class KnowledgeController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Adds a document and queues its indexing. */
    @Post("sources")
    async add(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: AddSourceRequest,
    ): Promise<SourceRefResponse> {
        const result = await this.commandBus.execute(
            new AddSourceCommand({ request: toAddSourceRequest(workspaceId, input), principal }),
        )
        return toSourceRefResponse(result)
    }

    /** Puts a failed or credit-blocked document back on the queue. */
    @Post("sources/:sourceId/retry")
    async retry(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: SourceIdRequest,
    ): Promise<SourceRefResponse> {
        const result = await this.commandBus.execute(
            new RetrySourceCommand({ request: { workspaceId, sourceId: params.sourceId }, principal }),
        )
        return toSourceRefResponse(result)
    }

    /** Reads a document again, optionally with new text. */
    @Post("sources/:sourceId/reindex")
    async reindex(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: SourceIdRequest,
        @Body() input: ReindexSourceRequest,
    ): Promise<SourceRefResponse> {
        const result = await this.commandBus.execute(
            new ReindexSourceCommand({
                request: toReindexSourceRequest(workspaceId, params.sourceId, input),
                principal,
            }),
        )
        return toSourceRefResponse(result)
    }

    /** Changes the metadata of a document. */
    @Patch("sources/:sourceId")
    @HttpCode(204)
    update(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: SourceIdRequest,
        @Body() input: UpdateSourceRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new UpdateSourceCommand({
                request: toUpdateSourceRequest(workspaceId, params.sourceId, input),
                principal,
            }),
        )
    }

    /** Deletes a document and takes back the facts it contributed to the brain. */
    @Delete("sources/:sourceId")
    @HttpCode(204)
    remove(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: SourceIdRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new DeleteSourceCommand({ request: { workspaceId, sourceId: params.sourceId }, principal }),
        )
    }

    /** Makes an address a browser uploads one document to. */
    @Post("uploads")
    async upload(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: CreateUploadRequest,
    ): Promise<UploadAddressResponse> {
        const result = await this.commandBus.execute(
            new CreateUploadCommand({ request: { workspaceId, filename: input.filename }, principal }),
        )
        return toUploadAddressResponse(result)
    }

    /** Shows what an agent would retrieve for a question. */
    @Post("ask")
    @HttpCode(200)
    async ask(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: AskKnowledgeRequest,
    ): Promise<Array<PassageResponse>> {
        const result = await this.queryBus.execute(
            new AskKnowledgeQuery({ request: toAskKnowledgeRequest(workspaceId, input), principal }),
        )
        return toPassagesResponse(result)
    }

    /** Queues the re-embedding of the stale passages of the workspace. */
    @Post("reembed")
    @HttpCode(204)
    reembed(@CurrentPrincipal() principal: Principal, @WorkspaceId() workspaceId: string): Promise<void> {
        return this.commandBus.execute(new RequestReembedCommand({ request: { workspaceId }, principal }))
    }

    /** Lists the files of a pasted Google Drive folder link. */
    @Post("drive/folder")
    @HttpCode(200)
    async linkedFolder(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: LinkedFolderRequest,
    ): Promise<FolderResponse> {
        const result = await this.queryBus.execute(
            new ListLinkedFolderQuery({ request: { workspaceId, url: input.url }, principal }),
        )
        return toFolderResponse(result)
    }

    /** Lists the files of a folder picked in the Google Picker. */
    @Post("drive/picked-folder")
    @HttpCode(200)
    async pickedFolder(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: PickedFolderRequest,
    ): Promise<PickedFolderResponse> {
        const result = await this.queryBus.execute(
            new ListPickedFolderQuery({
                request: { workspaceId, folderId: input.folderId, token: input.token },
                principal,
            }),
        )
        return toPickedFolderResponse(result)
    }
}
