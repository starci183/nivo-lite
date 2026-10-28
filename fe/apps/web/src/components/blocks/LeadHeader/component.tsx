import {
    Avatar,
    Badge,
    Button,
    DropdownMenu,
    IconButton,
    PageHeader,
    Text,
    type BadgeTone,
    type BreadcrumbItem,
} from "@starci/grammar/common"

import { SlotView } from "@/components/composites/SlotView"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { LeadPrimaryAction, DataSlot, SlotLabels } from "@/modules/types"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** What the header says about one lead, already worded. */
export interface HeaderView {
    readonly name: string
    readonly meta: string
    readonly stageLabel: string
    readonly stageTone: BadgeTone
    readonly primary: LeadPrimaryAction
}

/** The words of the header and its action bar. */
export interface HeaderLabels {
    readonly crumbLabel: string
    readonly reviewLabel: string
    readonly draftLabel: string
    readonly proposeLabel: string
    readonly officeLabel: string
    readonly officeHref: string
    readonly menuMore: string
    readonly menuRefresh: string
    readonly menuOutcome: string
    readonly menuCopy: string
    readonly slot: SlotLabels
}

/** The words and state of the lead page header. */
export interface LeadHeaderBaseProps {
    readonly props: {
        readonly slot: DataSlot<HeaderView>
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly labels: HeaderLabels
        readonly notice: string | null
        readonly isPending: boolean
    }
    readonly on: {
        readonly draft: (responsibilityId: string) => void
        readonly propose: () => void
        readonly refresh: () => void
        readonly copy: () => void
    }
}

const PLACEHOLDER: HeaderView = { name: "", meta: "", stageLabel: "", stageTone: "neutral", primary: { kind: "none" } }

/** Lead page header: the trail, the avatar with the name, the stage and the action bar. */
export const LeadHeaderBase = (props: LeadHeaderBaseProps) => {
    const { props: p } = props
    const l = p.labels
    return (
        <SlotView slot={p.slot} placeholder={PLACEHOLDER} labels={l.slot}>
            {(view, isSkeleton) => (
                <PageHeader
                    measure="product"
                    isSkeleton={isSkeleton}
                    breadcrumbs={{ label: l.crumbLabel, items: p.crumbs }}
                    mark={<Avatar name={view.name} size="lg" isSkeleton={isSkeleton} />}
                    title={view.name}
                    status={
                        <Badge tone={view.stageTone} isDot>
                            {view.stageLabel}
                        </Badge>
                    }
                    description={
                        <>
                            {view.meta}
                            <Text size="sm" tone="muted" live="polite">
                                {p.notice ?? ""}
                            </Text>
                        </>
                    }
                    actions={renderHeaderActions(props, view.primary, isSkeleton)}
                />
            )}
        </SlotView>
    )
}

/** Available primary actions and the overflow menu for the lead. */
const renderHeaderActions = (props: LeadHeaderBaseProps, primary: HeaderView["primary"], isSkeleton: boolean) => {
    const { props: p, on } = props
    const l = p.labels
    return (
        <div className={ACTIONS_CLASS_NAME}>
            {primary.kind === "review" ? (
                <Button intent="neutral" href="#execution" isSkeleton={isSkeleton}>
                    {l.reviewLabel}
                </Button>
            ) : null}
            {primary.kind === "draft" ? (
                <Button
                    intent="commit"
                    isPending={p.isPending}
                    isSkeleton={isSkeleton}
                    onPress={() => on.draft(primary.responsibilityId)}
                >
                    {l.draftLabel}
                </Button>
            ) : null}
            {primary.kind === "propose" ? (
                <Button intent="commit" isPending={p.isPending} isSkeleton={isSkeleton} onPress={on.propose}>
                    {l.proposeLabel}
                </Button>
            ) : null}
            <Button intent="neutral" href={l.officeHref} isSkeleton={isSkeleton}>
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
                        isSkeleton={isSkeleton}
                    />
                }
            />
        </div>
    )
}
