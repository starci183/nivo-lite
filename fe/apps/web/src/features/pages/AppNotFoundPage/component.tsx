import { AppNotFound } from "@/components/blocks/AppNotFound"

/** Props for the pure not-found page. */
export type AppNotFoundPageBaseProps = {
    readonly props: {
        readonly title: string
        readonly text: string
        readonly homeLabel: string
        readonly homeHref: string
    }
}

/** Draws the unknown-route page: the connected pane with its words and the way home. */
export const AppNotFoundPageBase = (props: AppNotFoundPageBaseProps) => (
    <AppNotFound
        title={props.props.title}
        text={props.props.text}
        homeLabel={props.props.homeLabel}
        homeHref={props.props.homeHref}
    />
)
