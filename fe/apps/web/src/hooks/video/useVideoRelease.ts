"use client"

import { useTranslations } from "next-intl"
import {
    useMutateApproveVideoProjectSwr,
    useMutateMarkVideoPublishedSwr,
    useMutateSaveVideoBrandSwr,
    useMutateShareVideoProjectSwr,
} from "@/hooks/swr"
import type { Brand } from "@/modules/video"
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
    const approve = (
        projectId: string,
        onResult?: (result: Awaited<ReturnType<typeof approveMutation.trigger>> | undefined) => void,
    ) => complete(() => approveMutation.trigger({ projectId }), t("status_approved"), onResult)
    const publish = (
        projectId: string,
        onResult?: (result: Awaited<ReturnType<typeof publishMutation.trigger>> | undefined) => void,
    ) => complete(() => publishMutation.trigger({ projectId }), t("postedNote"), onResult)
    const share = (
        projectId: string,
        onResult?: (result: Awaited<ReturnType<typeof shareMutation.trigger>> | undefined) => void,
    ) => complete(() => shareMutation.trigger({ projectId }), t("shared"), onResult)
    const saveBrand = (
        brand: Brand,
        onResult?: (result: Awaited<ReturnType<typeof brandMutation.trigger>> | undefined) => void,
    ) => complete(() => brandMutation.trigger(brand), t("brandSaved"), onResult)
    return { approve, publish, share, saveBrand, isPending }
}
