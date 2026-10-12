import { notFound } from "next/navigation"

/** Any path no route claims renders the locale segment's not-found slot, inside the locale layout. */
const Page = () => notFound()

export default Page
