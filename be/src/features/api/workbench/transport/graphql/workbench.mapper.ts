import type { Locale } from "@modules/platform/i18n"
import type { DoorAnswer } from "@modules/domain/workbench-door"
import type {
    WorkbenchFileConfirmRequest,
    WorkbenchFileDeleteRequest,
    WorkbenchFileLinkRequest,
    WorkbenchFileUploadRequest,
    WorkbenchFileUrlRequest,
    WorkbenchRequest,
} from "../../application/workbench.contracts"
import type { WorkbenchActionInput } from "./dto/workbench-action.input"
import type { WorkbenchAnswerType } from "./dto/workbench-answer.type"
import type { WorkbenchFileConfirmInput } from "./dto/workbench-file-confirm.input"
import type { WorkbenchFileDeleteInput } from "./dto/workbench-file-delete.input"
import type { WorkbenchFileLinkInput } from "./dto/workbench-file-link.input"
import type { WorkbenchFileUploadInput } from "./dto/workbench-file-upload.input"
import type { WorkbenchFileUrlInput } from "./dto/workbench-file-url.input"
import type { WorkbenchReadInput } from "./dto/workbench-read.input"

/** Maps the bounded read arguments and the selected workspace into the door request. */
export const toWorkbenchReadRequest = (
    workspaceId: string,
    input: WorkbenchReadInput,
    locale: Locale,
): WorkbenchRequest => ({
    workspaceId,
    name: input.name,
    payload: input.vars,
    locale,
})

/** Maps the bounded action arguments and the selected workspace into the door request. */
export const toWorkbenchActionRequest = (
    workspaceId: string,
    input: WorkbenchActionInput,
    locale: Locale,
): WorkbenchRequest => ({
    workspaceId,
    name: input.name,
    payload: input.input,
    locale,
    installationId: input.installationId,
})

/** Maps the door answer to the GraphQL type. */
export const toWorkbenchAnswerType = (answer: DoorAnswer): WorkbenchAnswerType => ({ data: answer.data })

/** Maps the bounded upload arguments and the selected workspace into the door request. */
export const toWorkbenchFileUploadRequest = (
    workspaceId: string,
    input: WorkbenchFileUploadInput,
): WorkbenchFileUploadRequest => ({
    call: { workspaceId, via: input.via, type: input.type, recordId: input.recordId, field: input.field },
    facts: { name: input.name, mime: input.mime, size: input.size },
})

/** Maps the bounded confirm arguments and the selected workspace into the door request. */
export const toWorkbenchFileConfirmRequest = (
    workspaceId: string,
    input: WorkbenchFileConfirmInput,
): WorkbenchFileConfirmRequest => ({
    call: { workspaceId, via: input.via, type: input.type, recordId: input.recordId, field: input.field },
    key: input.key,
    name: input.name,
})

/** Maps the bounded link arguments and the selected workspace into the door request. */
export const toWorkbenchFileLinkRequest = (workspaceId: string, input: WorkbenchFileLinkInput): WorkbenchFileLinkRequest => ({
    call: { workspaceId, via: input.via, type: input.type, recordId: input.recordId, field: input.field },
    key: input.key,
    name: input.name,
})

/** Maps the bounded url arguments and the selected workspace into the door request. */
export const toWorkbenchFileUrlRequest = (workspaceId: string, input: WorkbenchFileUrlInput): WorkbenchFileUrlRequest => ({
    call: {
        workspaceId,
        via: input.via,
        type: input.type,
        recordId: input.recordId,
        field: input.field,
        key: input.key,
    },
})

/** Maps the bounded delete arguments and the selected workspace into the door request. */
export const toWorkbenchFileDeleteRequest = (
    workspaceId: string,
    input: WorkbenchFileDeleteInput,
): WorkbenchFileDeleteRequest => ({
    call: {
        workspaceId,
        via: input.via,
        type: input.type,
        recordId: input.recordId,
        field: input.field,
        key: input.key,
    },
})
