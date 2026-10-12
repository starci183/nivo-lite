import { notFound } from "next/navigation"

/** The document title of this page. */
export { appNotFoundMetadata as generateMetadata } from "@/features/pages/AppNotFoundPage"

/** Any path no route claims renders the locale segment's not-found slot, inside the locale layout. */
const Page = () => notFound()

export default Page
