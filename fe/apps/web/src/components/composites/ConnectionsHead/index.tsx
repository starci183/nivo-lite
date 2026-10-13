import { Breadcrumbs, SectionHeader } from "@starci/grammar/common"
import { connectionsHeadClassNames } from "./classNames"

/** The words of the Connections heading, resolved by the page. */
type ConnectionsHeadProps = {
    readonly crumbLabel: string
    /** The first step of the trail: where the console starts. */
    readonly homeLabel: string
    readonly homeHref: string
    readonly title: string
    readonly description: string
    /** The summary line; absent while the page loads (STATE-8: heading and trail are real, figures are not). */
    readonly meta?: string
}

/** The trail above the page heading and the heading itself: one heading block. */
export const ConnectionsHead = (props: ConnectionsHeadProps) => (
    <div className={connectionsHeadClassNames.head}>
        <Breadcrumbs
            label={props.crumbLabel}
            items={[
                { id: "home", label: props.homeLabel, href: props.homeHref },
                { id: "connections", label: props.title },
            ]}
        />
        <SectionHeader
            level={1}
            title={props.title}
            description={props.description}
            {...(props.meta === undefined ? {} : { meta: props.meta })}
        />
    </div>
)
