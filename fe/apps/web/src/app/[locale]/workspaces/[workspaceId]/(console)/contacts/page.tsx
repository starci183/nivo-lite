import { ContactsPage } from "@/features/pages/ContactsPage"

export { contactsMetadata as generateMetadata } from "@/features/pages/ContactsPage"

/** Contacts: the people the agents work with. Owner and manager only; staff are told so in place. */
const Page = () => <ContactsPage contactId={null} />

export default Page
