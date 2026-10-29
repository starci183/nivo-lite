import { AuthConfirmPage } from "@/features/pages/AuthConfirmPage"

export { authConfirmMetadata as generateMetadata } from "@/features/pages/AuthConfirmPage"

type PageProps = Parameters<typeof AuthConfirmPage>[0]

/** The mailed confirm link of the back end sign-in. */
const Page = (props: PageProps) => <AuthConfirmPage searchParams={props.searchParams} />

export default Page
