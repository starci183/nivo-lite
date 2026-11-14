import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { WorkbenchFileConfirmCommand } from "../../application/workbench-file-confirm.command"
import { WorkbenchFileDeleteCommand } from "../../application/workbench-file-delete.command"
import { WorkbenchFileLinkCommand } from "../../application/workbench-file-link.command"
import { WorkbenchFileUploadCommand } from "../../application/workbench-file-upload.command"
import { WorkbenchFileUrlQuery } from "../../application/workbench-file-url.query"
import { WorkbenchAnswerType } from "./dto/workbench-answer.type"
import { WorkbenchFileConfirmInput } from "./dto/workbench-file-confirm.input"
import { WorkbenchFileDeleteInput } from "./dto/workbench-file-delete.input"
import { WorkbenchFileLinkInput } from "./dto/workbench-file-link.input"
import { WorkbenchFileUploadInput } from "./dto/workbench-file-upload.input"
import { WorkbenchFileUrlInput } from "./dto/workbench-file-url.input"
import {
    toWorkbenchAnswerType,
    toWorkbenchFileConfirmRequest,
    toWorkbenchFileDeleteRequest,
    toWorkbenchFileLinkRequest,
    toWorkbenchFileUploadRequest,
    toWorkbenchFileUrlRequest,
} from "./workbench.mapper"

@Resolver()
/**
 * GraphQL door of the files of records, for any declared `file` field. The five operations are the ones the API names
 * `nivo.api.nivo.file.upload`, `.confirm`, `.link`, `.get` and `.delete` map to, one to one: `fileUpload`, `fileConfirm`, `fileLink`,
 * `fileUrl`, `fileDelete`.
 */
export class WorkbenchFileResolver {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** A ticket to upload one file into a record's file field, as JSON text (`key`, `url`, `method`, `headers`, `expiresAt`). */
    @Mutation(() => WorkbenchAnswerType, { name: "fileUpload" })
    async fileUpload(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkbenchFileUploadInput,
    ): Promise<WorkbenchAnswerType> {
        const answer = await this.commandBus.execute(
            new WorkbenchFileUploadCommand({ request: toWorkbenchFileUploadRequest(workspaceId, input), principal }),
        )
        return toWorkbenchAnswerType(answer)
    }

    /** The reference of an uploaded file once the store proves it, as JSON text (`key`, `mime`, `size`, `name`); nothing is written to the record. */
    @Mutation(() => WorkbenchAnswerType, { name: "fileConfirm" })
    async fileConfirm(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkbenchFileConfirmInput,
    ): Promise<WorkbenchAnswerType> {
        const answer = await this.commandBus.execute(
            new WorkbenchFileConfirmCommand({ request: toWorkbenchFileConfirmRequest(workspaceId, input), principal }),
        )
        return toWorkbenchAnswerType(answer)
    }

    /** Attaches the confirmed upload to the record's file field and removes the file the field held, as JSON text (the reference). */
    @Mutation(() => WorkbenchAnswerType, { name: "fileLink" })
    async fileLink(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkbenchFileLinkInput,
    ): Promise<WorkbenchAnswerType> {
        const answer = await this.commandBus.execute(
            new WorkbenchFileLinkCommand({ request: toWorkbenchFileLinkRequest(workspaceId, input), principal }),
        )
        return toWorkbenchAnswerType(answer)
    }

    /** A short-lived signed read address of the file a record holds, as JSON text (`url`, `expiresAt`, `name`, `mime`, `size`). */
    @Query(() => WorkbenchAnswerType, { name: "fileUrl" })
    async fileUrl(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkbenchFileUrlInput,
    ): Promise<WorkbenchAnswerType> {
        const answer = await this.queryBus.execute(
            new WorkbenchFileUrlQuery({ request: toWorkbenchFileUrlRequest(workspaceId, input), principal }),
        )
        return toWorkbenchAnswerType(answer)
    }

    /** Clears the record's file field and removes its file from the store, as JSON text (`removed`). */
    @Mutation(() => WorkbenchAnswerType, { name: "fileDelete" })
    async fileDelete(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkbenchFileDeleteInput,
    ): Promise<WorkbenchAnswerType> {
        const answer = await this.commandBus.execute(
            new WorkbenchFileDeleteCommand({ request: toWorkbenchFileDeleteRequest(workspaceId, input), principal }),
        )
        return toWorkbenchAnswerType(answer)
    }
}
