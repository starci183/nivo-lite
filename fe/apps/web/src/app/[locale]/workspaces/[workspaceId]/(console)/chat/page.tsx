import type { ReactElement } from "react"
import { TeamChatPage } from "@/features/pages/TeamChatPage"

export { teamChatMetadata as generateMetadata } from "@/features/pages/TeamChatPage"

type PageProps = { readonly searchParams: Promise<{ readonly room?: string }> }

/** The team chat: the rooms of the viewer beside the room the address names. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { room } = await props.searchParams
    return <TeamChatPage room={room ?? null} />
}

export default Page
