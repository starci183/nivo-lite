import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { consoleBreadcrumbsOf } from "@/modules/page-header"
import { TeamChatPageBase, type TeamChatPageBaseProps } from "./component"

/** The document title of the page. */
export const teamChatMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("teamChat")
    return { title: t("title") }
}

/** What the chat route is given: the room its address names, or none (a phone then shows the list). */
interface TeamChatPageProps {
    readonly workspaceId: string
    readonly room: string | null
}

/** The words of the panes, resolved on the server so the page and its loading state say the same; no workspace while loading. */
const chatCopy = async (workspaceId?: string): Promise<Omit<TeamChatPageBaseProps["props"], "room">> => {
    const t = await getTranslations("teamChat")
    const shell = await getTranslations("shell")
    return {
        breadcrumbs: consoleBreadcrumbsOf({
            workspaceId,
            label: shell("crumbLabel"),
            home: shell("crumbHome"),
            current: t("title"),
        }),
        gridLabel: t("gridLabel"),
        listLabel: t("listLabel"),
        roomLabel: t("threadLabel"),
    }
}

/** The team chat route: the rooms of the viewer beside the room the address names; both read and write through the back end in the browser. */
export const TeamChatPage = async (props: TeamChatPageProps): Promise<ReactElement> => (
    <TeamChatPageBase props={{ ...(await chatCopy(props.workspaceId)), room: props.room }} />
)

/** The same panes while the route loads: the trail and pane heads stay real, the rooms and the thread draw their own skeletons. */
export const TeamChatLoadingPage = async (): Promise<ReactElement> => (
    <TeamChatPageBase props={{ ...(await chatCopy()), room: null }} />
)
