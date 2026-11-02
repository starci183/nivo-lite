import { Button, Cluster, DropdownMenu, IconButton, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { LeadPrimaryAction } from "@/modules/types"

/** The words of the action bar. */
export interface HeaderActionLabels {
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

/** The words and state of the lead page action bar. */
export interface LeadHeaderActionsBaseProps {
    readonly props: {
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

/** Lead page actions: the primary command, the Office link and the overflow menu, with the notice of the last command. */
export const LeadHeaderActionsBase = (props: LeadHeaderActionsBaseProps) => {
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
