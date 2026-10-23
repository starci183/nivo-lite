import { ForgotForm } from "@/components/blocks/ForgotForm"

/** Props for {@link ForgotPasswordPageBase}. */
export interface ForgotPasswordPageBaseProps {
    readonly props: { readonly initialEmail?: string | undefined }
}

/** Draws the forgot-password card; the auth layout supplies the frame around it. */
export const ForgotPasswordPageBase = (props: ForgotPasswordPageBaseProps) => (
    <ForgotForm initialEmail={props.props.initialEmail} />
)
