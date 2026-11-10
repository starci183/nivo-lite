import { EmptyNotice, Page } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** The words and the way out of the not-found page. */
export interface AppNotFoundBaseProps {
    readonly props: {
        readonly title: string
        readonly text: string
        readonly homeLabel: string
    }
    readonly on: { readonly goHome: () => void }
}

/** Draws the unknown-route and no-access page: one frameless notice with no bar around it, so nothing about the console shows. */
export const AppNotFoundBase = (props: AppNotFoundBaseProps) => (
    <Page chrome="bleed" minHeight="lg">
        <EmptyNotice
            frame="frameless"
            message={props.props.title}
            description={props.props.text}
            iconSource={nivoIconSource("explore", "leading")}
            actionLabel={props.props.homeLabel}
            actionEndArrow
            onAction={props.on.goHome}
        />
    </Page>
)
