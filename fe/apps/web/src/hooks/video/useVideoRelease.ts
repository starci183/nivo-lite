"use client"

import { useTranslations } from "next-intl"
import {
    useMutateApproveVideoProjectSwr,
    useMutateMarkVideoPublishedSwr,
    useMutateSaveVideoBrandSwr,
    useMutateShareVideoProjectSwr,
} from "@/hooks/swr"
import type { Brand } from "@/modules/video"
import { projectCommandOf } from "./video.shared"
import { useVideoRefresh } from "./useVideoRefresh"
import type { VideoOwner } from "./useVideoRefresh"

/** Approves, publishes and shares a video and saves the brand kit, reports every outcome, and reads the video data again. */
export const useVideoRelease = (owner?: VideoOwner) => {
    const t = useTranslations("video")
    const { complete, isPending } = useVideoRefresh(owner)
    const approveMutation = useMutateApproveVideoProjectSwr()
    const publishMutation = useMutateMarkVideoPublishedSwr()
    const shareMutation = useMutateShareVideoProjectSwr()
    const brandMutation = useMutateSaveVideoBrandSwr()
    const approve = projectCommandOf(
        complete,
        (projectId) => approveMutation.trigger({ projectId }),
        t("status_approved"),
    )
    const publish = projectCommandOf(complete, (projectId) => publishMutation.trigger({ projectId }), t("postedNote"))
    const share = projectCommandOf(complete, (projectId) => shareMutation.trigger({ projectId }), t("shared"))
    const saveBrand = (
        brand: Brand,
        onResult?: (result: Awaited<ReturnType<typeof brandMutation.trigger>> | undefined) => void,
    ) => complete(() => brandMutation.trigger(brand), t("brandSaved"), onResult)
    return { approve, publish, share, saveBrand, isPending }
}
