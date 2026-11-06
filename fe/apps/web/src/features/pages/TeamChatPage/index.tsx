import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { TeamChat } from "@/components/blocks/TeamChat"

/** The document title of the page. */
export const teamChatMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("teamChat")
    return { title: t("title") }
}

/** The team chat route: the chat block is its root and draws the one `Page` of rooms and thread panes. */
export const TeamChatPage = () => <TeamChat kind="page" />
