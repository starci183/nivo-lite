import { Button, PageHeader, Skeleton } from "@starci/grammar/common"

/** The words of the Connections heading, resolved by the page. */
type ConnectionsHeadProps = {
    readonly crumbLabel: string
    /** The first step of the trail: where the console starts. */
    readonly homeLabel: string
    readonly homeHref: string
    readonly title: string
    readonly description: string
    /** The primary command: opens the library, where a connector is chosen and its wizard opens. */
    readonly addLabel: string
    readonly addHref: string
    /** The summary line; while it is absent the line draws as a placeholder (STATE-8: heading and trail are real, figures are not). */
    readonly meta?: string
}

/** The Connections header band: trail, heading, summary and the add command. Place it outside the page PageContainer. */
export const ConnectionsHead = (props: ConnectionsHeadProps) => (
    <PageHeader
        title={props.title}
        description={props.description}
        meta={props.meta ?? <Skeleton shape="text" />}
        breadcrumbs={{
            label: props.crumbLabel,
            items: [
                { id: "home", label: props.homeLabel, href: props.homeHref },
                { id: "connections", label: props.title },
            ],
        }}
        actions={
            <Button intent="commit" href={props.addHref}>
                {props.addLabel}
            </Button>
        }
    />
)
