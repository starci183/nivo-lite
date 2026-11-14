import { useState } from "react"
import { useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { BlockFiles } from "@nivo-lite/agent-sdk/block"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { bytesText, fileProblemOf, roomOf, type FileLimits } from "../../rows/file-field"

/** The file a block fills and how its words read. */
export interface FileUploadTarget {
    /** The host's file port; null on a host with no file store. */
    readonly files: BlockFiles | null
    /** The record type of the record. */
    readonly type: string
    /** The id of the record; empty before it is saved. */
    readonly id: string
    /** The file field of the record type. */
    readonly field: string
    /** What the field's declaration accepts and allows. */
    readonly limits: FileLimits
    /** How many files the field holds now; what a list field's room is counted from. */
    readonly count: number
    /** The words of a library key. */
    readonly words: (text: SpecText) => string
    /** The accepted types as words, for a refusal. */
    readonly typesText: string
    /** Reads the record again once its file changed. */
    readonly onChanged: () => void
}

/** A file that is going up. */
export interface UploadProgress {
    /** The name of the file that goes up. */
    readonly name: string
    /** The share of the bytes sent, from 0 to 1. */
    readonly share: number
}

/** What an upload shows and does. */
export interface FileUploadView {
    /** The file going up and the share of its bytes sent, from 0 to 1; null when none goes up. */
    readonly progress: UploadProgress | null
    /** Why the last chosen file was refused before anything was sent; undefined when it was not. */
    readonly problem: string | undefined
    /** Checks the chosen files against the field's limits and puts them on the field (a field of one file takes the first; a list field as many as it has room for, one after the other). */
    readonly choose: (files: Array<File>) => void
    /** Removes the file from the field (a list field: the one file `key` names); it rejects when the store refused, so a confirmation stays open. */
    readonly remove: (key?: string) => Promise<void>
}

/** The upload and the removal of the file of one record field, with their progress and refusals worded for the viewer. */
export const useFileUpload = (target: FileUploadTarget): FileUploadView => {
    const host = useBlockHost()
    const { files, type, id, field, limits, count, words, typesText, onChanged } = target
    const [progress, setProgress] = useState<UploadProgress | null>(null)
    const [problem, setProblem] = useState<string | undefined>(undefined)
    const problemText = (file: File): string | undefined => {
        const refused = fileProblemOf(limits, file)
        if (refused === null) return undefined
        if (refused === "empty") return words({ key: "fileUploadEmpty" })
        if (refused === "type") return words({ key: "fileUploadWrongType" }).replaceAll("{types}", typesText)
        return words({ key: "fileUploadTooBig" }).replaceAll("{size}", bytesText(limits.maxBytes, host.locale()))
    }
    const putOne = (file: File): Promise<void> => {
        setProgress({ name: file.name, share: 0 })
        return files === null
            ? Promise.resolve()
            : files
                  .upload(type, id, field, file, { onProgress: (share) => setProgress({ name: file.name, share }) })
                  .then(() => {
                      host.notify("success", words({ key: "fileUploadDone" }))
                  })
    }
    const putFrom = (queue: ReadonlyArray<File>): Promise<void> => {
        const [next, ...rest] = queue
        return next === undefined ? Promise.resolve() : putOne(next).then(() => putFrom(rest))
    }
    const choose = (picked: Array<File>): void => {
        if (files === null) return
        const room = limits.max === null ? 1 : roomOf(limits, count)
        const taken = picked.slice(0, room)
        if (taken.length === 0) return
        const refused = taken.map((file) => problemText(file)).find((text) => text !== undefined)
        const overflow =
            picked.length > room && limits.max !== null
                ? words({ key: "fileUploadListRoom" }).replaceAll("{room}", String(room))
                : undefined
        setProblem(refused ?? overflow)
        if (refused !== undefined) return
        putFrom(taken)
            .catch(() => host.notify("danger", words({ key: "fileUploadFailed" })))
            .finally(() => {
                setProgress(null)
                onChanged()
            })
    }
    const remove = (key?: string): Promise<void> => {
        if (files === null) return Promise.resolve()
        return files
            .remove(type, id, field, key)
            .then(() => {
                host.notify("success", words({ key: "fileUploadRemoved" }))
                onChanged()
            })
            .catch((error: unknown) => {
                host.notify("danger", words({ key: "fileUploadRemoveFailed" }))
                throw error
            })
    }
    return { progress, problem, choose, remove }
}
