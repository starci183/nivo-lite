import { WorkThreadsPage } from "@/features/pages/WorkThreadsPage"

/** The document title of this page. */
export { workThreadsPageMetadata as generateMetadata } from "@/features/pages/WorkThreadsPage"

/** The work threads route: people and agents tag each other in one thread, with its execution chain beside it. */
const Page = () => <WorkThreadsPage />

export default Page
