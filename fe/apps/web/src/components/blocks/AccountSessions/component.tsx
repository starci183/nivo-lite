import { Alert, Badge, Button, ListRow, Region, SectionHeader, SurfaceListCard, Text } from "@starci/grammar/common"
import { FormNotice } from "@/components/composites/FormNotice"
import type { SessionRowView } from "@/hooks/account"
import { ACTIONS_CLASS_NAME, SECTION_CLASS_NAME } from "./classNames"

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
        readonly failedTitle: string
        readonly failTitle: string
        readonly rows: ReadonlyArray<SessionRowView>
        /** True when the device list could not be read. */
        readonly isFailed: boolean
        readonly isSkeleton: boolean
        /** True when another device is signed in (also while the rows load, so the action keeps its place). */
        readonly hasOthers: boolean
        /** The row being signed out, `this` for the current device, or `others` while every other device is. */
        readonly busy?: string | undefined
        readonly error?: string
        readonly done?: string
    }
    readonly on: {
        readonly revoke: (id: string) => void
        readonly signOutOthers: () => void
        readonly signOutThis: () => void
    }
}

/** Draws the signed-in devices and their sign-out actions. */
export const AccountSessionsBase = (props: AccountSessionsBaseProps) => {
    const isBusy = props.props.busy !== undefined
    return (
        <Region labelledBy="account-sessions-title" className={SECTION_CLASS_NAME}>
            <SectionHeader
                id="account-sessions-title"
                level={2}
                title={props.props.title}
                description={props.props.hint}
            />
            {props.props.isFailed ? <Alert tone="negative" title={props.props.failedTitle} /> : null}
            <SurfaceListCard ariaLabel={props.props.title} isLoading={props.props.isSkeleton}>
                {props.props.rows.map((row) => (
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
            <FormNotice failTitle={props.props.failTitle} error={props.props.error} done={props.props.done} />
            <div className={ACTIONS_CLASS_NAME}>
                {props.props.hasOthers ? (
                    <Button
                        isSkeleton={props.props.isSkeleton}
                        intent="destructive"
                        step="entry"
                        isPending={props.props.busy === "others"}
                        isDisabled={isBusy}
                        onPress={props.on.signOutOthers}
                    >
                        {props.props.signOutOthersLabel}
                    </Button>
                ) : (
                    <Text size="sm" tone="muted">
                        {props.props.noOthersLabel}
                    </Text>
                )}
            </div>
        </Region>
    )
}
