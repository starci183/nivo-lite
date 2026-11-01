import { notFound } from "next/navigation"

/** The document title of this page. */
export { appNotFoundMetadata as generateMetadata } from "@/features/pages/AppNotFoundPage"

/** Any path no route claims renders the console not-found slot, inside the console frame. */
const Page = () => notFound()

export default Page
