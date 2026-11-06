import { AuthorityPage } from "@/features/pages/AuthorityPage"

/** The document title of this page. */
export { authorityPageMetadata as generateMetadata } from "@/features/pages/AuthorityPage"

/** The authority route ("Giao quyen"): the list of sections; a desktop opens the first, a phone shows the list. */
const Page = () => <AuthorityPage />

export default Page
