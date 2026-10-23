import { SignupForm } from "@/components/blocks/SignupForm"

/** Props for {@link SignupPageBase}. */
export interface SignupPageBaseProps {
    readonly props: {
        readonly next?: string | undefined
        readonly invited: boolean
        readonly initialEmail?: string | undefined
    }
}

/** Draws the sign-up card; the auth layout supplies the frame around it. */
export const SignupPageBase = (props: SignupPageBaseProps) => (
    <SignupForm next={props.props.next} invited={props.props.invited} initialEmail={props.props.initialEmail} />
)
