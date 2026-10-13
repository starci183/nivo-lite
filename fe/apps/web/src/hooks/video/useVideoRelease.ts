import { useTranslations } from "next-intl"
import { useMutateApproveVideoProjectSwr } from "@/hooks/swr/api/graphql/mutations/useMutateApproveVideoProjectSwr"
import { useMutateMarkVideoPublishedSwr } from "@/hooks/swr/api/graphql/mutations/useMutateMarkVideoPublishedSwr"
import { useMutateSaveVideoBrandSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveVideoBrandSwr"
import { useMutateShareVideoProjectSwr } from "@/hooks/swr/api/graphql/mutations/useMutateShareVideoProjectSwr"
import type { Brand } from "@/modules/video"
import { useVideoRefresh } from "./useVideoRefresh"

/** Approves, publishes and shares a video and saves the brand kit, reports every outcome, and reads the video data again. */
export const useVideoRelease = () => {
    const t = useTranslations("video")
    const { complete } = useVideoRefresh()
    const approveMutation = useMutateApproveVideoProjectSwr()
    const publishMutation = useMutateMarkVideoPublishedSwr()
    const shareMutation = useMutateShareVideoProjectSwr()
    const brandMutation = useMutateSaveVideoBrandSwr()
    const approve = (projectId: string) => complete(() => approveMutation.trigger({ projectId }), t("status_approved"))
    const publish = (projectId: string) => complete(() => publishMutation.trigger({ projectId }), t("postedNote"))
    const share = (projectId: string) => complete(() => shareMutation.trigger({ projectId }), t("shared"))
    const saveBrand = (brand: Brand) => complete(() => brandMutation.trigger(brand), t("brandSaved"))
    return { approve, publish, share, saveBrand }
}
