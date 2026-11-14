import type { ReactElement } from "react"
import { SettingsPage } from "@/features/pages/SettingsPage"

export { settingsMetadata as generateMetadata } from "@/features/pages/SettingsPage"

type PageProps = { readonly params: Promise<{ workspaceId: string }> }

/** Workspace settings, the theme tab: the workspace's brand colour, font and corners, with a live preview. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <SettingsPage workspaceId={(await props.params).workspaceId} view="theme" />
)

export default Page
