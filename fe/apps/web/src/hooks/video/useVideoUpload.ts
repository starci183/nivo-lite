"use client"

import { useTranslations } from "next-intl"
import { mutate } from "@/modules/viewer-cache"
import { useMutateCreateVideoMediaUploadSwr, QUERY_VIDEO_MEDIA_SWR_KEY, usePutPresignedSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { useGraphQLWithToast, useRestWithToast } from "@/modules/toast"

type UseVideoUploadResult = {
    upload: (files: ReadonlyArray<File>) => Promise<string[]>
    isMutating: boolean
}

/** Uploads directly to the storage URL supplied by GraphQL, then refreshes the active workspace's media library. */
export const useVideoUpload = (): UseVideoUploadResult => {
    const t = useTranslations("video")
    const runGraphQL = useGraphQLWithToast()
    const runRest = useRestWithToast()
    const { trigger: putPresigned } = usePutPresignedSwr()
    const { trigger, isMutating } = useMutateCreateVideoMediaUploadSwr()
    const workspaceId = useWorkspaceId()
    const uploadOne = async (file: File): Promise<string | undefined> => {
        const ticket = await runGraphQL(() => trigger({ name: file.name, type: file.type, size: file.size }), {
            successMessage: t("saved"),
        })
        if (ticket === undefined) return undefined
        const sent = await runRest(() => putPresigned({ url: ticket.signedUrl, file, contentType: file.type }), {
            successMessage: t("saved"),
        })
        return sent === null ? undefined : ticket.path
    }
    const upload = async (files: ReadonlyArray<File>): Promise<string[]> => {
        const results = await Promise.all(files.map(uploadOne))
        const paths = results.filter((path): path is string => path !== undefined)
        await mutate((key) => Array.isArray(key) && key[0] === QUERY_VIDEO_MEDIA_SWR_KEY && key[1] === workspaceId)
        return paths
    }
    return { upload, isMutating }
}
