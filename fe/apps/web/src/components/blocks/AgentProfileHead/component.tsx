import { Badge, DropdownMenu, IconButton, Page, Stack } from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AgentMark } from "@/components/leaves/AgentMark"
import { nivoIconSource } from "@/components/leaves/Icon"

/** What the heading shows once the agent arrived, every word resolved. */
export interface ProfileHeadView {
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    readonly title: string
    /** The @handle and the module the agent works for. */
    readonly description: string
    /** The agent id: the generated avatar of an agent without a picture. */
    readonly seed: string
    /** The picture the owner gave the agent, or null. */
    readonly picture: string | null
    readonly chips: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: BadgeTone }>
}

/** Copy and slot of the heading of an agent profile. */
export interface AgentProfileHeadBaseProps {
    /** The page body, drawn under the heading. */
    readonly children: ReactNode
    readonly props: {
        readonly crumbLabel: string
        /** The heading's menu: its accessible name and the entry that opens the picture-and-name dialog (a link: the dialog is open while the address says so). */
        readonly menu: { readonly label: string; readonly identityLabel: string; readonly identityHref: string }
        /** The heading once the agent arrived, or the placeholder while it has not. */
        readonly head: ProfileHeadView
        /** True while the agent is unresolved: the heading draws its measured placeholders. */
        readonly isLoading: boolean
    }
}

/** Draws the agent profile as one Page: trail, name and role, the identity chips and the identity menu in its header; the page body inside it. */
export const AgentProfileHeadBase = (props: AgentProfileHeadBaseProps) => {
    const view = props.props
    const { head, isLoading } = view
    return (
        <Page
            measure="product"
            isLoading={isLoading}
            header={{
                breadcrumbs: { label: view.crumbLabel, items: head.crumbs },
                title: head.title,
                description: head.description,
                mark: (
                    <AgentMark label={head.title} seed={head.seed} src={head.picture} size="lg" isLoading={isLoading} />
                ),
                status: head.chips.map((chip) => (
                    <Badge key={chip.id} tone={chip.tone} isLoading={isLoading}>
                        {chip.label}
                    </Badge>
                )),
                actions: (
                    <DropdownMenu
                        placement="bottom end"
                        entries={[
                            {
                                id: "identity",
                                label: view.menu.identityLabel,
                                href: view.menu.identityHref,
                            },
                        ]}
                        trigger={
                            <IconButton
                                intent="neutral"
                                source={nivoIconSource("more", "leading")}
                                label={view.menu.label}
                            />
                        }
                    />
                ),
            }}
        >
            <Stack gap="region">{props.children}</Stack>
        </Page>
    )
}
