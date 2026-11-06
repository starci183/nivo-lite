import type { ReactElement } from "react"
import { AccountPage } from "@/features/pages/AccountPage"

export { accountMetadata as generateMetadata } from "@/features/pages/AccountPage"

type PageProps = { readonly params: Promise<{ workspaceId: string }> }

/** Account area: email, password, sign-in methods and signed-in devices (the profile has its own page). */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <AccountPage workspaceId={(await props.params).workspaceId} />
)

export default Page
