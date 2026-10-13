import { SignupPage } from "@/features/pages/SignupPage"

export { signupMetadata as generateMetadata } from "@/features/pages/SignupPage"

type PageProps = Parameters<typeof SignupPage>[0]

/** Public sign-up page; `?invite=<token>` carries an invitation through. */
const Page = (props: PageProps) => <SignupPage searchParams={props.searchParams} />

export default Page
