import { HomeRedirectPage } from "@/features/pages/HomeRedirectPage"

export { homeRedirectMetadata as generateMetadata } from "@/features/pages/HomeRedirectPage"

/** The console has no front page: the dashboard is where a signed-in reader starts (the proxy sends everyone else to sign in). */
const Page = () => <HomeRedirectPage />

export default Page
