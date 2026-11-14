import type { ReactElement } from "react"
import { SettingsPage } from "@/features/pages/SettingsPage"

export { settingsMetadata as generateMetadata } from "@/features/pages/SettingsPage"

type PageProps = { readonly params: Promise<{ workspaceId: string }> }

/** Workspace settings: the name, the time zone and the logo of the workspace. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <SettingsPage workspaceId={(await props.params).workspaceId} />
)

export default Page
