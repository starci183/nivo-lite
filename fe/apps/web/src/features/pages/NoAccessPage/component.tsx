import { navigation } from "@/modules/i18n"

/** Where the old no-access address sends the person. */
export interface NoAccessPageBaseProps {
    readonly props: {
        readonly href: string
        readonly locale: string
    }
}

/** Draws nothing: the old no-access entry only redirects to the workspaces screen. */
export const NoAccessPageBase = (props: NoAccessPageBaseProps) => {
    navigation.redirect({ href: props.props.href, locale: props.props.locale })
    return null
}
