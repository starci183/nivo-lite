import { PageContainer, SurfaceListCard, TextAction } from "@starci/grammar/common"
import { ConnectionViewTabs } from "@/components/blocks/ConnectionViewTabs"
import { ConnectionsHead } from "@/components/composites/ConnectionsHead"
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
    <>
        <ConnectionsHead
            crumbLabel={props.props.crumbLabel}
            homeLabel={props.props.crumbHome}
            homeHref={props.props.homeHref}
            title={props.props.title}
            description={props.props.description}
            addLabel={props.props.addLabel}
            addHref={props.props.addHref}
        />
        <PageContainer measure="product">
            <div className={classNames.page}>
                <ConnectionViewTabs selected="connected" />
                <SurfaceListCard label={props.props.connectedLabel} headingLevel={2} isLoading />
                <TextAction href={props.props.automationsHref} isSkeleton>
                    {props.props.automationsLink}
                </TextAction>
            </div>
        </PageContainer>
    </>
)
