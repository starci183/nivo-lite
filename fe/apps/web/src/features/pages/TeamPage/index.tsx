import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { TeamPanes } from "@/components/blocks/TeamPanes"

/** The document title of the page. */
export const teamMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("team")
    return { title: t("title") }
}

/** The team route: the panes block is its root and draws the one `Page` of the people, the invitations and the opened one. */
export const TeamPage = () => <TeamPanes />
