import { LoginForm } from "@/components/blocks/LoginForm"

/** Props for {@link LoginPageBase}. */
export interface LoginPageBaseProps {
    readonly props: {
        readonly next?: string | undefined
        readonly errorCode?: string | undefined
        readonly notice?: string | undefined
    }
}

/** Draws the sign-in card; the auth layout supplies the frame around it. */
export const LoginPageBase = (props: LoginPageBaseProps) => (
    <LoginForm next={props.props.next} errorCode={props.props.errorCode} notice={props.props.notice} />
)
