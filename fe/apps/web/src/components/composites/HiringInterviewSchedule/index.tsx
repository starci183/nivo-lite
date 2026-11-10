import type { HiringViews, HiringActions } from "@/modules/types"

type HiringInterviewScheduleProps = HiringViews["interviewsFields"] & {
    readonly on: HiringActions["interviewsActions"]
    readonly isLoading: boolean
}
import {
    Alert,
    Badge,
    Button,
    Cluster,
    EmptyNotice,
    Grid,
    Section,
    Stack,
    SurfaceCard,
    Text,
    type ListRowData,
} from "@starci/grammar/common"

/** What the commands of an interview need to know. */
interface InterviewActionsView {
    readonly id: string
    readonly candidateId: string
    readonly isConfirmed: boolean
}

/** One interview, every word already resolved. */
interface InterviewRowView extends InterviewActionsView {
    readonly title: string
    readonly meta: string
}

/** One invitation still waiting for the candidate to pick a time. */
interface InvitationRowView extends InterviewRowView {
    readonly badge: string
    readonly proposed: string
    readonly note: string | null
    readonly copyLabel: string
}

/** Draws the interviews tab: a week calendar of confirmed interviews (an agenda on phones) and the invitations awaiting an answer. */
export const HiringInterviewSchedule = (props: HiringInterviewScheduleProps) => {
    const { copy, weekLabel, isThisWeek, days, invitations, invitationsFact, error } = props
    const { on } = props
    return (
        <>
            <Section
                isLoading={props.isLoading}
                title={copy.ivTabTitle}
                action={
                    <Cluster gap="inline">
                        <Button isLoading={props.isLoading} intent="dismiss" size="sm" onPress={on.previousWeek}>
                            {copy.ivPrevWeek}
                        </Button>
                        <Text isLoading={props.isLoading} as="span" size="sm" isStrong>
                            {weekLabel}
                        </Text>
                        <Button isLoading={props.isLoading} intent="dismiss" size="sm" onPress={on.nextWeek}>
                            {copy.ivNextWeek}
                        </Button>
                        {isThisWeek ? null : (
                            <Button isLoading={props.isLoading} intent="neutral" size="sm" onPress={on.thisWeek}>
                                {copy.ivBackToThisWeek}
                            </Button>
                        )}
                    </Cluster>
                }
            >
                {error === null ? null : (
                    <Alert
                        tone="negative"
                        title={copy.errorTitle}
                        description={error}
                        dismissLabel={copy.dismiss}
                        onDismiss={on.clearError}
                    />
                )}
                <Grid kind="week" label={weekLabel}>
                    {days.map((day) => (
                        <SurfaceCard
                            isLoading={props.isLoading}
                            key={day.key}
                            kind="list"
                            label={day.label}
                            labelEnd={day.isToday ? <Badge tone="accent">{copy.ivToday}</Badge> : undefined}
                            items={day.items.map((row) => interviewItem(props, row))}
                            empty={<EmptyNotice message={copy.ivDayEmpty} />}
                        />
                    ))}
                </Grid>
                <Section
                    isLoading={props.isLoading}
                    kind="list"
                    title={copy.ivWaitingTitle}
                    fact={invitationsFact}
                    items={invitations.map((row) => invitationItem(props, row))}
                    empty={<EmptyNotice message={copy.ivWaitingEmpty} description={copy.ivWaitingEmptyBody} />}
                />
            </Section>
        </>
    )
}

/** One interview of a day as a row: its commands sit in the detail under the row. */
const interviewItem = (props: HiringInterviewScheduleProps, row: InterviewRowView): ListRowData => ({
    id: row.id,
    title: row.title,
    description: row.meta,
    detail: <InterviewActions {...props} row={row} />,
})

/** One invitation awaiting an answer as a row: the warning badge, its copy command, and the proposed times under it. */
const invitationItem = (props: HiringInterviewScheduleProps, row: InvitationRowView): ListRowData => ({
    id: row.id,
    title: row.title,
    description: row.meta,
    badges: [{ label: row.badge, tone: "warning" }],
    action: { label: row.copyLabel, intent: "dismiss", press: () => props.on.copy(row.id) },
    detail: (
        <Stack gap="identity">
            <Text isLoading={props.isLoading} size="xs" tone="muted">
                {row.proposed}
            </Text>
            {row.note === null ? null : (
                <Text isLoading={props.isLoading} size="sm">
                    {row.note}
                </Text>
            )}
            <InterviewActions {...props} row={row} />
        </Stack>
    ),
})

/** Commands available for one interview. */
const InterviewActions = (props: InterviewActionsProps) => {
    const { copy, isBusy } = props
    const { on, row } = props
    return (
        <Cluster gap="inline">
            <Button endArrow isLoading={props.isLoading} intent="dismiss" size="sm" onPress={() => on.open(row.candidateId)}>
                {copy.pipeOpen}
            </Button>
            {row.isConfirmed ? (
                <Button
                    isLoading={props.isLoading}
                    intent="neutral"
                    size="sm"
                    isDisabled={isBusy}
                    onPress={() => on.status(row.id, "done")}
                >
                    {copy.ivMarkDone}
                </Button>
            ) : null}
            {row.isConfirmed ? (
                <Button
                    isLoading={props.isLoading}
                    intent="neutral"
                    size="sm"
                    isDisabled={isBusy}
                    onPress={() => on.status(row.id, "no_show")}
                >
                    {copy.ivMarkNoShow}
                </Button>
            ) : null}
            <Button
                isLoading={props.isLoading}
                intent="neutral"
                size="sm"
                isDisabled={isBusy}
                onPress={() => on.status(row.id, "cancelled")}
            >
                {copy.ivCancel}
            </Button>
        </Cluster>
    )
}

/** Inputs of the extracted list section. */
type InterviewActionsProps = HiringInterviewScheduleProps & { readonly row: InterviewActionsView }
