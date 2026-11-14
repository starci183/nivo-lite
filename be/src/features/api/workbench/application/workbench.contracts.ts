import type { RecordFileFacts } from "@modules/domain/record-files"
import type { DoorFileCall } from "@modules/domain/workbench-door"
import type { Locale } from "@modules/platform/i18n"

/** The call of a screen to the workbench door: the selected workspace, the id of the read or action and its JSON text. */
export interface WorkbenchRequest {
    /** The workspace selected in the request header; membership is proved by the door capability. */
    readonly workspaceId: string
    /** The id of the read or action, `<module>.<name>`. */
    readonly name: string
    /** The variables of a read or the input of an action, as JSON text. */
    readonly payload: string
    /** The language of the viewer, from the request header. */
    readonly locale: Locale
    /** The installation the screen is opened for; an action only (a read and a file call are not installation-scoped). */
    readonly installationId?: string | undefined
}

/** The call of a screen for a ticket to upload one file into a declared `file` field of a record. */
export interface WorkbenchFileUploadRequest {
    /** The workspace, the action the upload is for and the record field. */
    readonly call: DoorFileCall
    /** The file name, its content type and its exact size. */
    readonly facts: RecordFileFacts
}

/** The call of a screen to confirm an uploaded file and get the reference to store. */
export interface WorkbenchFileConfirmRequest {
    /** The workspace, the action the upload is for and the record field. */
    readonly call: DoorFileCall
    /** The object key the ticket named. */
    readonly key: string
    /** The file name to keep. */
    readonly name: string
}

/** The call of a screen to attach an uploaded file to a record's file field. */
export interface WorkbenchFileLinkRequest {
    /** The workspace, the action the file is attached for and the record field. */
    readonly call: DoorFileCall
    /** The object key a ticket named and a confirmation proved. */
    readonly key: string
    /** The file name to keep. */
    readonly name: string
}

/** The call of a screen for a short-lived signed read address of the file a record holds in one field (or one item of a list field). */
export interface WorkbenchFileUrlRequest {
    /** The workspace, the read or action the address is for, the record field and, for a list field, the item. */
    readonly call: DoorFileCall
}

/** The call of a screen to clear the file a record holds in one field (or remove one item of a list field) and remove it from the store. */
export interface WorkbenchFileDeleteRequest {
    /** The workspace, the action the delete is for, the record field and, for a list field, the item. */
    readonly call: DoorFileCall
}
