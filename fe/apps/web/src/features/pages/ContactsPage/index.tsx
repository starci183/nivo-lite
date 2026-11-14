import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ContactsPanes } from "@/components/blocks/ContactsPanes"

/** The document title of the contacts pages. */
export const contactsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("contacts")
    return { title: t("title") }
}

/** What the page reads the open person from: the `id` segment of the address, none on the list itself. */
interface ContactsPageProps {
    readonly contactId: string | null
}

/** The contacts route: the people with the one the address names open; its block draws the one `Page`. */
export const ContactsPage = (props: ContactsPageProps) => <ContactsPanes contactId={props.contactId} />

/** The same page while the list route loads: the header stays real text, the block draws its own skeleton. */
export const ContactsLoadingPage = () => <ContactsPanes contactId={null} />

/** The same page while the route of one person loads: the person is not known yet, so its cards draw as geometry. */
export const ContactLoadingPage = () => <ContactsPanes contactId={undefined} />
