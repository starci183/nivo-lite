import { Badge, Button, ListRow, Region, Stack, SurfaceListCard, Text } from "@starci/grammar/common"
import { FormNotice } from "@/components/composites/FormNotice"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SessionRowView, SlotLabels } from "@/modules/types"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** Copy, rows and state the connected sessions section supplies. */
export interface AccountSessionsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly currentLabel: string
        readonly signOutLabel: string
        readonly signOutThisLabel: string
        readonly signOutOthersLabel: string
        readonly noOthersLabel: string
        readonly failTitle: string
        /** The signed-in devices once they arrived. */
        readonly slot: DataSlot<ReadonlyArray<SessionRowView>>
        /** Two devices, the current one and another: the skeleton keeps the sign-out action in its place. */
        readonly placeholder: ReadonlyArray<SessionRowView>
        readonly labels: SlotLabels
        /** The row being signed out, `this` for the current device, or `others` while every other device is. */
        readonly busy?: string | undefined
        readonly error?: string
        readonly done?: string
    }
    readonly on: {
        readonly revoke: (id: string) => void
        readonly signOutOthers: () => void
        readonly signOutThis: () => void
        readonly retry: () => void
    }
}

/** What the sign-out-others action needs. */
type OthersActionProps = {
    readonly base: AccountSessionsBaseProps
    readonly hasOthers: boolean
    readonly isSkeleton: boolean
}

/** Draws the sign-out-others button, or the note that no other device is signed in. */
const OthersAction = (props: OthersActionProps) =>
    props.hasOthers ? (
        <Button
            isSkeleton={props.isSkeleton}
            intent="destructive"
            step="entry"
            isPending={props.base.props.busy === "others"}
            isDisabled={props.base.props.busy !== undefined}
            onPress={props.base.on.signOutOthers}
        >
            {props.base.props.signOutOthersLabel}
        </Button>
    ) : (
        <Text size="sm" tone="muted">
            {props.base.props.noOthersLabel}
        </Text>
    )

/** Draws the signed-in devices and their sign-out actions. */
export const AccountSessionsBase = (props: AccountSessionsBaseProps) => {
    const isBusy = props.props.busy !== undefined
    return (
        <Region label={props.props.title}>
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.labels}
                onRetry={props.on.retry}
            >
                {(rows, isSkeleton) => (
                    <Stack gap="row">
                        <SurfaceListCard
                            label={props.props.title}
                            headingLevel={2}
                            isLoading={isSkeleton}
                            footer={
                                <Text size="sm" tone="muted">
                                    {props.props.hint}
                                </Text>
                            }
                        >
                            {rows.map((row) => (
                                <ListRow
                                    key={row.id}
                                    title={row.device}
                                    description={row.facts}
                                    badges={
                                        row.isCurrent ? (
                                            <Badge tone="accent" isDot>
                                                {props.props.currentLabel}
                                            </Badge>
                                        ) : null
                                    }
                                    actions={
                                        row.isCurrent ? (
                                            <Button
                                                intent="neutral"
                                                isPending={props.props.busy === "this"}
                                                isDisabled={isBusy}
                                                onPress={props.on.signOutThis}
                                            >
                                                {props.props.signOutThisLabel}
                                            </Button>
                                        ) : (
                                            <Button
                                                intent="destructive"
                                                step="entry"
                                                isPending={props.props.busy === row.id}
                                                isDisabled={isBusy}
                                                onPress={() => props.on.revoke(row.id)}
                                            >
                                                {props.props.signOutLabel}
                                            </Button>
                                        )
                                    }
                                />
                            ))}
                        </SurfaceListCard>
                        <FormNotice
                            failTitle={props.props.failTitle}
                            error={props.props.error}
                            done={props.props.done}
                        />
                        <div className={ACTIONS_CLASS_NAME}>
                            <OthersAction
                                base={props}
                                hasOthers={rows.some((row) => !row.isCurrent)}
                                isSkeleton={isSkeleton}
                            />
                        </div>
                    </Stack>
                )}
            </SlotView>
        </Region>
    )
}
