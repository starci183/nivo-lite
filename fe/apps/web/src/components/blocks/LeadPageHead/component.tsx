import { Avatar, Badge, Button, Cluster, DropdownMenu, IconButton, Page, Text } from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { LeadPrimaryAction } from "@/modules/types"

/** What the head says about one lead, already worded. */
interface HeaderView {
    readonly name: string
    readonly meta: string
    readonly stageLabel: string
    readonly stageTone: BadgeTone
}

/** The words of the action bar. */
interface HeaderActionLabels {
    readonly reviewLabel: string
    readonly draftLabel: string
    readonly proposeLabel: string
    readonly officeLabel: string
    readonly officeHref: string
    readonly menuMore: string
    readonly menuRefresh: string
    readonly menuOutcome: string
    readonly menuCopy: string
}

/** The words, state and commands of the lead page head. */
export interface LeadPageHeadBaseProps {
    /** The page body under the head. */
    readonly children: ReactNode
    readonly props: {
        readonly crumbLabel: string
        /** The trail, the lead (its name, or a skeleton while it loads) last. */
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        /** The lead the head names (none while it failed or is missing). */
        readonly view: HeaderView | undefined
        /** True while the lead loads: every slot is inert geometry. */
        readonly isSkeleton: boolean
        /** The title kept when the lead failed. */
        readonly fallbackTitle: string
        readonly primary: LeadPrimaryAction
        readonly labels: HeaderActionLabels
        readonly notice: string | null
        readonly isPending: boolean
        readonly isLoading: boolean
    }
    readonly on: {
        readonly draft: (responsibilityId: string) => void
        readonly propose: () => void
        readonly refresh: () => void
        readonly copy: () => void
    }
}

const PLACEHOLDER: HeaderView = { name: "-", meta: "-", stageLabel: "-", stageTone: "neutral" }

/** Lead page actions: the primary command, the Office link and the overflow menu, with the notice of the last command. */
const HeaderActions = (props: Omit<LeadPageHeadBaseProps, "children">) => {
    const { props: p, on } = props
    const l = p.labels
    const primary = p.primary
    return (
        <Cluster gap="inline">
            <Text size="sm" tone="muted" live="polite">
                {p.notice ?? ""}
            </Text>
            {primary.kind === "review" ? (
                <Button intent="neutral" href="#execution" isLoading={p.isLoading}>
                    {l.reviewLabel}
                </Button>
            ) : null}
            {primary.kind === "draft" ? (
                <Button
                    intent="commit"
                    isPending={p.isPending}
                    isLoading={p.isLoading}
                    onPress={() => on.draft(primary.responsibilityId)}
                >
                    {l.draftLabel}
                </Button>
            ) : null}
            {primary.kind === "propose" ? (
                <Button intent="commit" isPending={p.isPending} isLoading={p.isLoading} onPress={on.propose}>
                    {l.proposeLabel}
                </Button>
            ) : null}
            <Button intent="neutral" href={l.officeHref} isLoading={p.isLoading}>
                {l.officeLabel}
            </Button>
            <DropdownMenu
                placement="bottom end"
                entries={[
                    { id: "refresh", label: l.menuRefresh, onAction: on.refresh },
                    { id: "outcome", label: l.menuOutcome, href: "#outcome" },
                    { id: "copy", label: l.menuCopy, onAction: on.copy },
                ]}
                trigger={
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("more", "leading")}
                        label={l.menuMore}
                        isLoading={p.isLoading}
                    />
                }
            />
        </Cluster>
    )
}

/**
 * Draws the one `Page` of the lead route: the trail, the lead's mark, name, stage and actions, and the body under them. While the
 * lead loads each slot is inert geometry; when it failed the title keeps the page name and the panels below say why.
 */
export const LeadPageHeadBase = (props: LeadPageHeadBaseProps) => {
    const p = props.props
    const view = p.isSkeleton ? PLACEHOLDER : p.view
    return (
        <Page
            measure="product"
            header={{
                breadcrumbs: { label: p.crumbLabel, items: p.crumbs },
                mark: view === undefined ? null : <Avatar name={view.name} size="lg" isLoading={p.isSkeleton} />,
                title: view?.name ?? p.fallbackTitle,
                status:
                    view === undefined ? null : (
                        <Badge tone={view.stageTone} isDot isLoading={p.isSkeleton}>
                            {view.stageLabel}
                        </Badge>
                    ),
                description: view === undefined ? null : view.meta,
                actions: <HeaderActions props={p} on={props.on} />,
            }}
        >
            {props.children}
        </Page>
    )
}
