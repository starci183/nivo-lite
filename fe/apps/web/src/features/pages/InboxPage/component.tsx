import { InboxFeed } from "@/components/blocks/InboxFeed"
import { InboxPageLayout } from "@/components/composites/InboxPageLayout"

/** Copy the inbox page supplies. */
export interface InboxPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHomeLabel: string
        readonly crumbHomeHref: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
    }
}

/** Draws the inbox page: the heading with its trail, then the connected feed of received inputs. */
export const InboxPageBase = (props: InboxPageBaseProps) => {
    const p = props.props
    return (
        <InboxPageLayout
            crumbLabel={p.crumbLabel}
            crumbs={[
                { id: "home", label: p.crumbHomeLabel, href: p.crumbHomeHref },
                { id: "inbox", label: p.title },
            ]}
            eyebrow={p.eyebrow}
            title={p.title}
            description={p.description}
            feed={<InboxFeed />}
        />
    )
}
