"use client"

import { useCallback, useEffect, useState } from "react"
import { usePutPresignedSwr } from "@/hooks/swr"
import { useGraphQLWithToast, useRestWithToast } from "@/modules/toast"
import { avatarProblemOf, type AvatarDoors, type AvatarProblem } from "./avatar.shared"

/** The view `useAvatarUpload` returns. */
export interface AvatarUploadView {
    preview: string | null
    problem: AvatarProblem | null
    isBusy: boolean
    choose: (files: ReadonlyArray<File>) => Promise<void>
    remove: () => Promise<void>
}

/**
 * Uploads a picture straight to Storage and keeps it, or removes it. The chosen file previews at once (a local object URL) while
 * it uploads; a refused type or size is reported before anything is sent; every back end failure is toasted.
 */
export const useAvatarUpload = (doors: AvatarDoors): AvatarUploadView => {
    const runGraphQL = useGraphQLWithToast()
    const runRest = useRestWithToast()
    const { trigger: putPresigned } = usePutPresignedSwr()
    const [preview, setPreview] = useState<string | null>(null)
    const [problem, setProblem] = useState<AvatarProblem | null>(null)
    const [isBusy, setIsBusy] = useState(false)

    useEffect(() => {
        if (preview === null) return undefined
        return () => URL.revokeObjectURL(preview)
    }, [preview])

    const choose = useCallback(
        async (files: ReadonlyArray<File>): Promise<void> => {
            const file = files[0]
            if (file === undefined) return
            const refused = avatarProblemOf(file)
            setProblem(refused)
            if (refused !== null) return
            setPreview(URL.createObjectURL(file))
            setIsBusy(true)
            const ticket = await runGraphQL(() => doors.request({ contentType: file.type, sizeBytes: file.size }), {
                showSuccessToast: false,
            })
            const sent =
                ticket === undefined
                    ? null
                    : await runRest(() => putPresigned({ url: ticket.signedUrl, file, contentType: file.type }), {
                          showSuccessToast: false,
                      })
            const kept =
                ticket === undefined || sent === null
                    ? undefined
                    : await runGraphQL(() => doors.set(ticket.path), { successMessage: doors.savedMessage })
            if (kept !== undefined) await doors.refresh()
            setPreview(null)
            setIsBusy(false)
        },
        [doors, runGraphQL, runRest, putPresigned],
    )

    const remove = useCallback(async (): Promise<void> => {
        setProblem(null)
        setIsBusy(true)
        const removed = await runGraphQL(() => doors.set(null), { successMessage: doors.removedMessage })
        if (removed !== undefined) await doors.refresh()
        setIsBusy(false)
    }, [doors, runGraphQL])

    return { preview, problem, isBusy, choose, remove }
}
