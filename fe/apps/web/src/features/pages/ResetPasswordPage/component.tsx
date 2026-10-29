import { ResetForm } from "@/components/blocks/ResetForm"

/** Props for {@link ResetPasswordPageBase}. */
export interface ResetPasswordPageBaseProps {
    readonly props: { readonly expired: boolean; readonly token: string }
}

/** Draws the reset-password card; the auth layout supplies the frame around it. */
export const ResetPasswordPageBase = (props: ResetPasswordPageBaseProps) => (
    <ResetForm expired={props.props.expired} token={props.props.token} />
)
