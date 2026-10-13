import { useTranslations } from "next-intl"
import { VideoWorkbenchLoadingPageBase } from "./component"

/** Shown while the video workbench loads. */
export const VideoWorkbenchLoadingPage = () => {
    const t = useTranslations("video")
    return (
        <VideoWorkbenchLoadingPageBase
            props={{
                figures: [
                    { id: "rendering", term: t("figRendering") },
                    { id: "ready", term: t("figReady") },
                    { id: "published", term: t("figPublished") },
                    { id: "credits", term: t("figCredits") },
                ],
                libraryTab: t("tabVideos"),
                brandTab: t("tabBrand"),
            }}
        />
    )
}
