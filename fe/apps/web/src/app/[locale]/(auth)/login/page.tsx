import { LoginPage } from "@/features/pages/LoginPage"

export { loginMetadata as generateMetadata } from "@/features/pages/LoginPage"

type PageProps = Parameters<typeof LoginPage>[0]

/** Public sign-in page. */
const Page = (props: PageProps) => <LoginPage searchParams={props.searchParams} />

export default Page
