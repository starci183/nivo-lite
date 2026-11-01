"use client"

import { useState } from "react"
import { usePutPresignedSwr } from "@/hooks/swr"
import { useRestWithToast } from "@/modules/toast"
import { chatFileProblemOf } from "./chatFile.shared"
import type { ChatFileProblem } from "./chatFile.shared"

/** Where the back end says a file goes. */
interface ChatFileAddress {
    readonly path: string
    readonly signedUrl: string
}

/** A file that landed in the store: what a message names. */
interface UploadedChatFile {
    readonly path: string
    readonly name: string
}

/**
 * The file that goes with the next message of a composer, a chat or the Office: the choice, its refusal at once, and the upload
 * straight to the store through the address the caller asks for. The back end checks what landed when the message is sent.
 */
export const useChatFile = () => {
    const runRest = useRestWithToast()
    const { trigger: putFile } = usePutPresignedSwr()
    const [file, setFile] = useState<File | null>(null)
    const [problem, setProblem] = useState<ChatFileProblem | null>(null)

    const choose = (chosen: File) => {
        const refused = chatFileProblemOf(chosen)
        setProblem(refused)
        setFile(refused === null ? chosen : null)
    }
    const clear = () => {
        setFile(null)
        setProblem(null)
    }
    /** Uploads the file: null when none is chosen, undefined when the upload failed and the failure was shown. */
    const upload = async (
        addressOf: (chosen: File) => Promise<ChatFileAddress | undefined>,
    ): Promise<UploadedChatFile | null | undefined> => {
        if (file === null) return null
        const address = await addressOf(file)
        if (address === undefined) return undefined
        return runRest(
            async () => {
                await putFile({ url: address.signedUrl, file })
                return { path: address.path, name: file.name }
            },
            { showSuccessToast: false },
        )
    }
    return { file, problem, choose, clear, upload }
}
