import { ForgotPasswordPage } from "@/features/pages/ForgotPasswordPage"

export { forgotPasswordMetadata as generateMetadata } from "@/features/pages/ForgotPasswordPage"

type PageProps = Parameters<typeof ForgotPasswordPage>[0]

/** Public "forgot password" page. */
const Page = (props: PageProps) => <ForgotPasswordPage searchParams={props.searchParams} />

export default Page
