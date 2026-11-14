import type { ReactElement } from "react"
import { ContactsPage } from "@/features/pages/ContactsPage"

export { contactsMetadata as generateMetadata } from "@/features/pages/ContactsPage"

/** What the page receives from Next. */
interface ContactRouteProps {
    readonly params: Promise<{ readonly workspaceId: string; readonly id: string }>
}

/** One person: the people with this one open, its own address. */
const Page = async ({ params }: ContactRouteProps): Promise<ReactElement> => {
    const { id } = await params
    return <ContactsPage contactId={id} />
}

export default Page
