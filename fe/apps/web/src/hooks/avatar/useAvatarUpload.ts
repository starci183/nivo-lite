"use client"

import { useCallback, useEffect, useState } from "react"
import { usePutPresignedSwr } from "@/hooks/swr"
import { useGraphQLWithToast, useRestWithToast } from "@/modules/toast"
import { avatarProblemOf } from "./avatar.shared"
import type { AvatarDoors, AvatarProblem } from "./avatar.shared"

/**
 * Uploads a picture straight to Storage and keeps it, or removes it. The chosen file previews at once (a local object URL) while
 * it uploads; a refused type or size is reported before anything is sent; every back end failure is toasted.
 */
export const useAvatarUpload = (doors: AvatarDoors) => {
    const runGraphQL = useGraphQLWithToast()
    const runRest = useRestWithToast()
    const { trigger: putPresigned } = usePutPresignedSwr()
    const [preview, setPreview] = useState<string | null>(null)
    const [problem, setProblem] = useState<AvatarProblem | null>(null)
    const [isBusy, setBusy] = useState(false)

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
            setBusy(true)
            const ticket = await runGraphQL(() => doors.request({ contentType: file.type, sizeBytes: file.size }), {
                showSuccessToast: false,
            })
            const sent =
                ticket === undefined
                    ? null
                    : await runRest(() => putPresigned({ url: ticket.signedUrl, file }), { showSuccessToast: false })
            const kept =
                ticket === undefined || sent === null
                    ? undefined
                    : await runGraphQL(() => doors.set(ticket.path), { successMessage: doors.savedMessage })
            if (kept !== undefined) await doors.refresh()
            setPreview(null)
            setBusy(false)
        },
        [doors, runGraphQL, runRest, putPresigned],
    )

    const remove = useCallback(async (): Promise<void> => {
        setProblem(null)
        setBusy(true)
        const removed = await runGraphQL(() => doors.set(null), { successMessage: doors.removedMessage })
        if (removed !== undefined) await doors.refresh()
        setBusy(false)
    }, [doors, runGraphQL])

    return { preview, problem, isBusy, choose, remove }
}
