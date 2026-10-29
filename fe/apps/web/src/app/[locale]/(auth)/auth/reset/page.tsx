import { AuthResetPage } from "@/features/pages/AuthResetPage"

export { authResetMetadata as generateMetadata } from "@/features/pages/AuthResetPage"

type PageProps = Parameters<typeof AuthResetPage>[0]

/** The mailed reset link of the back end sign-in. */
const Page = (props: PageProps) => <AuthResetPage searchParams={props.searchParams} />

export default Page
