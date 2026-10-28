import { Button, Page } from "@starci/grammar/common"

/** Props for the pure not-found page. */
export type AppNotFoundPageBaseProps = {
    readonly props: {
        readonly title: string
        readonly text: string
        readonly homeLabel: string
        readonly homeHref: string
    }
}

/** Draws the unknown-route page: the heading band with its words, and the way home as the body. */
export const AppNotFoundPageBase = (props: AppNotFoundPageBaseProps) => (
    <Page measure="reading" header={{ title: props.props.title, description: props.props.text }}>
        <Button intent="neutral" href={props.props.homeHref}>
            {props.props.homeLabel}
        </Button>
    </Page>
)
