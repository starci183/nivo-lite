import type { HiringViews, HiringActions } from "@/modules/types"

interface HiringJobListProps extends Pick<HiringViews["jobsFields"], "copy" | "fact" | "rows" | "isBusy" | "error"> {
    readonly on: HiringActions["jobListActions"]
    readonly isLoading: boolean
}
import {
    Alert,
    Button,
    EmptyNotice,
    Stack,
    SurfaceCard,
    Text,
    type ItemAction,
    type ListRowData,
} from "@starci/grammar/common"

/** Draws the jobs tab: the job posts, what the owner can do with each, and the editor and ad dialogs. */
export const HiringJobList = (props: HiringJobListProps) => {
    const { copy, rows, error, fact } = props
    const { on } = props
    return (
        <>
            {error === null ? null : <Alert tone="negative" title={copy.errorTitle} description={error} />}
            <SurfaceCard
                isLoading={props.isLoading}
                kind="list"
                label={copy.jobsTitle}
                headingLevel={2}
                fact={fact}
                labelEnd={
                    <Button isLoading={props.isLoading} intent="commit" onPress={on.create}>
                        {copy.jobsCreate}
                    </Button>
                }
                items={rows.map((row) => itemOf(row, props))}
                empty={
                    <EmptyNotice
                        message={copy.jobsEmptyTitle}
                        description={copy.jobsEmptyBody}
                        actionLabel={copy.jobsCreate}
                        onAction={on.create}
                    />
                }
            />
        </>
    )
}

/** One job's facts, publication link and available commands as item data: the next transition is the visible action, the rest is in the menu. */
const itemOf = (row: HiringViews["jobRow"], props: HiringJobListProps): ListRowData => {
    const { copy, isBusy } = props
    const { on } = props
    const primary = row.transitions.find((transition) => transition.isPrimary)
    const action: ItemAction | undefined =
        primary !== undefined
            ? {
                  label: primary.label,
                  intent: "alternative",
                  isDisabled: isBusy,
                  press: () => on.transition(row.id, primary.to),
              }
            : undefined
    const entries = [
        ...(row.copyLabel === null ? [] : [{ id: "copy", label: row.copyLabel, onAction: () => on.copy(row.id) }]),
        { id: "ad", label: copy.jobsWriteAd, onAction: () => on.openAd(row.id) },
        { id: "edit", label: copy.jobsEdit, onAction: () => on.edit(row.id) },
        ...row.transitions
            .filter((transition) => transition !== primary)
            .map((transition) => ({
                id: `to-${transition.to}`,
                label: transition.label,
                isDisabled: isBusy,
                onAction: () => on.transition(row.id, transition.to),
            })),
    ]
    return {
        id: row.id,
        title: row.title,
        badges: [{ label: row.statusLabel, tone: row.statusTone, isDot: true }],
        description: row.facts,
        ...(action === undefined ? {} : { action }),
        ...(entries.length === 0 ? {} : { menu: { label: row.title, entries } as const }),
        detail: (
            <Stack gap="identity">
                <Text isLoading={props.isLoading} size="sm">
                    {row.counts}
                </Text>
                {row.publicUrl === null ? null : (
                    <Text isLoading={props.isLoading} size="xs" tone="muted">
                        {row.publicUrl}
                    </Text>
                )}
            </Stack>
        ),
    }
}
