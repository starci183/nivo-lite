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

type Saved<Result> = Promise<Result | undefined>
type OnResult<Result> = (result: Result | undefined) => void
type ApprovedProject = Awaited<ReturnType<ReturnType<typeof useMutateApproveVideoProjectSwr>["trigger"]>>
type PublishedProject = Awaited<ReturnType<ReturnType<typeof useMutateMarkVideoPublishedSwr>["trigger"]>>
type SharedProject = Awaited<ReturnType<ReturnType<typeof useMutateShareVideoProjectSwr>["trigger"]>>
type SavedBrand = Awaited<ReturnType<ReturnType<typeof useMutateSaveVideoBrandSwr>["trigger"]>>

type UseVideoReleaseResult = {
    approve: (projectId: string, onResult?: OnResult<ApprovedProject>) => Saved<ApprovedProject>
    publish: (projectId: string, onResult?: OnResult<PublishedProject>) => Saved<PublishedProject>
    share: (projectId: string, onResult?: OnResult<SharedProject>) => Saved<SharedProject>
    saveBrand: (brand: Brand, onResult?: OnResult<SavedBrand>) => Saved<SavedBrand>
    isPending: boolean
}

/** Approves, publishes and shares a video and saves the brand kit, reports every outcome, and reads the video data again. */
export const useVideoRelease = (owner?: VideoOwner): UseVideoReleaseResult => {
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
    const saveBrand = (brand: Brand, onResult?: OnResult<SavedBrand>): Saved<SavedBrand> =>
        complete(() => brandMutation.trigger(brand), t("brandSaved"), onResult)
    return { approve, publish, share, saveBrand, isPending }
}
