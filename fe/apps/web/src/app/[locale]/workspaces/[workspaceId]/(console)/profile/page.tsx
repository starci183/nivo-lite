import type { ReactElement } from "react"
import { ProfilePage } from "@/features/pages/ProfilePage"

export { profileMetadata as generateMetadata } from "@/features/pages/ProfilePage"

type PageProps = { readonly params: Promise<{ workspaceId: string }> }

/** The signed-in person's profile: picture and display name. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <ProfilePage workspaceId={(await props.params).workspaceId} />
)

export default Page
