"use client"

import { useState } from "react"
import { useMutateRequestChatFileUploadSwr, usePutPresignedSwr } from "@/hooks/swr"
import { chatFileRefusalOf } from "@/modules/teamChat"

/** The view `useTeamChatFile` returns. */
export interface TeamChatFilePicker {
    /** The file that goes with the next message, or null. */
    readonly file: File | null
    /** The refusal code of the last choice or upload (the door's vocabulary, or "failed"), or null. */
    readonly problem: string | null
    readonly isUploading: boolean
    readonly choose: (chosen: File) => void
    readonly clear: () => void
    /** Uploads the chosen file to the room: its file key, null when none is chosen, undefined when it failed (the problem says why). */
    readonly upload: (roomId: string) => Promise<string | null | undefined>
}

/**
 * The file that goes with the next message of a room: the choice, its refusal at once (type and size, as the door judges them), and
 * the upload straight to the store through the address the door hands out for that room. The door checks what landed when the message
 * is sent.
 */
export const useTeamChatFile = (workspaceId: string): TeamChatFilePicker => {
    const request = useMutateRequestChatFileUploadSwr(workspaceId)
    const { trigger: putFile } = usePutPresignedSwr()
    const [file, setFile] = useState<File | null>(null)
    const [problem, setProblem] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    const choose = (chosen: File): void => {
        const refused = chatFileRefusalOf(chosen)
        setProblem(refused)
        setFile(refused === null ? chosen : null)
    }
    const clear = (): void => {
        setFile(null)
        setProblem(null)
    }
    const upload = async (roomId: string): Promise<string | null | undefined> => {
        if (file === null) return null
        setIsUploading(true)
        try {
            const answer = await request.trigger({
                roomId,
                fileName: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
            })
            if (answer.upload === null) {
                setProblem(answer.refusal ?? "failed")
                return undefined
            }
            const signed = Object.fromEntries(answer.upload.headers.map((header) => [header.name, header.value]))
            await putFile({ url: answer.upload.uploadUrl, file, contentType: file.type, headers: signed })
            return answer.upload.fileKey
        } catch {
            setProblem("failed")
            return undefined
        } finally {
            setIsUploading(false)
        }
    }
    return { file, problem, isUploading, choose, clear, upload }
}
