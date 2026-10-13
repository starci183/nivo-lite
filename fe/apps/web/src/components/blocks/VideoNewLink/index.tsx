import { getTranslations } from "next-intl/server"
import { editorHref } from "@/hooks/video"
import { VideoNewLinkBase } from "./component"

/** The "new video" command of the workbench header: a link to the wizard's first step. */
export const VideoNewLink = async () => {
    const t = await getTranslations("video")
    return <VideoNewLinkBase props={{ label: t("newVideo"), href: editorHref("new", "goal") }} />
}
