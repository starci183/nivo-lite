import { isUuid } from "@/hooks/video"
import { VideoWorkbenchPageBase } from "./component"

/** Route selections and installation context of the video workbench. */
interface VideoWorkbenchPageProps {
    readonly tab?: string | null
    readonly focus?: string | null
    readonly installation?: { readonly id: string }
}

/** Server shell of the video workbench; every block below it reads its own data in the browser through GraphQL hooks. */
export const VideoWorkbenchPage = (props: VideoWorkbenchPageProps) => {
    const focus = props.focus ?? null
    return (
        <VideoWorkbenchPageBase
            props={{
                installationId: props.installation?.id ?? null,
                tab: props.tab ?? null,
                focus,
                isEditor: focus === "new" || (focus !== null && isUuid(focus)),
                libraryTab: props.tab === "brand" ? "brand" : "library",
            }}
        />
    )
}
