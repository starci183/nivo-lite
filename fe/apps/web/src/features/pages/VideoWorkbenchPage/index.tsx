import { getTranslations } from "next-intl/server"
import { isUuid } from "@/hooks/video"
import { VideoWorkbenchPageBase } from "./component"

/** Route selections and installation of the video workbench. */
interface VideoWorkbenchPageProps {
    readonly tab?: string | null
    readonly focus?: string | null
    readonly installationId?: string
}

/** Server shell of the video workbench: words the tabs and hands the ids; every block below it reads its own data in the browser. */
export const VideoWorkbenchPage = async (props: VideoWorkbenchPageProps) => {
    const t = await getTranslations("video")
    const focus = props.focus ?? null
    return (
        <VideoWorkbenchPageBase
            props={{
                installationId: props.installationId ?? null,
                tab: props.tab ?? null,
                focus,
                isEditor: focus === "new" || (focus !== null && isUuid(focus)),
                tabs: { library: t("tabVideos"), brand: t("tabBrand") },
            }}
        />
    )
}
