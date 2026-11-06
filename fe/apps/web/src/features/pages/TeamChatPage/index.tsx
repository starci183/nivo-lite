import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { TeamChatPageBase } from "./component"

/** The document title of the page. */
export const teamChatMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("teamChat")
    return { title: t("title") }
}

/** What the chat route is given: the room its address names, or none (a phone then shows the list). */
interface TeamChatPageProps {
    readonly room: string | null
}

/** The team chat route: the rooms of the viewer beside the room the address names; both read and write through the back end in the browser. */
export const TeamChatPage = async (props: TeamChatPageProps): Promise<ReactElement> => {
    const t = await getTranslations("teamChat")
    return (
        <TeamChatPageBase
            props={{
                gridLabel: t("gridLabel"),
                listLabel: t("listLabel"),
                roomLabel: t("threadLabel"),
                room: props.room,
            }}
        />
    )
}
