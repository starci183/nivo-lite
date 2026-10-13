import { ResetPasswordPage } from "@/features/pages/ResetPasswordPage"

export { resetPasswordMetadata as generateMetadata } from "@/features/pages/ResetPasswordPage"

type PageProps = Parameters<typeof ResetPasswordPage>[0]

/** Set a new password after the recovery link. */
const Page = (props: PageProps) => <ResetPasswordPage searchParams={props.searchParams} />

export default Page
