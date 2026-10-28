import { Page, SurfaceListCard, TextAction } from "@starci/grammar/common"
import { ConnectionsHeadContent } from "@/components/composites/ConnectionsHead"
import { connectionsLoadingClassNames as classNames } from "./classNames"

/** The words of the loading page: everything real except the figures. */
export interface ConnectionsLoadingPageBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly homeHref: string
        readonly connectedLabel: string
        readonly libraryLabel: string
        readonly automationsLink: string
        readonly automationsHref: string
        readonly addLabel: string
        readonly addHref: string
    }
}

/**
 * STATE-8: the Connections page itself, with no data yet - the trail, the heading, the tab labels and the link are real; the
 * connection list is a skeleton.
 */
export const ConnectionsLoadingPageBase = (props: ConnectionsLoadingPageBaseProps) => (
    <Page
        header={ConnectionsHeadContent({
            crumbLabel: props.props.crumbLabel,
            homeLabel: props.props.crumbHome,
            homeHref: props.props.homeHref,
            title: props.props.title,
            description: props.props.description,
            addLabel: props.props.addLabel,
            addHref: props.props.addHref,
            tabs: {
                label: props.props.title,
                selectedKey: "connected",
                items: [
                    { id: "connected", label: props.props.connectedLabel },
                    { id: "library", label: props.props.libraryLabel },
                ],
            },
        })}
        measure="product"
    >
        <div className={classNames.page}>
            <SurfaceListCard label={props.props.connectedLabel} headingLevel={2} isLoading />
            <TextAction href={props.props.automationsHref} isSkeleton>
                {props.props.automationsLink}
            </TextAction>
        </div>
    </Page>
)
