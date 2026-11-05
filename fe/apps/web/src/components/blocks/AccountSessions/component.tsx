import { AlertDialog, Button, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { FormNotice } from "@/components/composites/FormNotice"
import { nivoIconSource } from "@/components/leaves/Icon"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SessionRowView, SlotLabels } from "@/modules/types"

/** Copy, rows and state the connected sessions section supplies. */
export interface AccountSessionsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly currentLabel: string
        readonly signOutLabel: string
        readonly signOutOthersLabel: string
        readonly failTitle: string
        /** The signed-in devices once they arrived. */
        readonly slot: DataSlot<ReadonlyArray<SessionRowView>>
        /** Two devices, the current one and another: the skeleton keeps the sign-out action in its place. */
        readonly placeholder: ReadonlyArray<SessionRowView>
        readonly labels: SlotLabels
        /** The row being signed out, `this` for the current device, or `others` while every other device is. */
        readonly busy?: string | undefined
        /** The other device the person is asked to confirm signing out, with the words of the question. */
        readonly confirm?: {
            readonly id: string
            readonly title: string
            readonly body: string
            readonly cancelLabel: string
        }
        readonly error?: string
        readonly done?: string
    }
    readonly on: {
        readonly askRevoke: (id: string) => void
        readonly cancelRevoke: () => void
        readonly revoke: (id: string) => void
        readonly signOutOthers: () => void
        readonly signOutThis: () => void
        readonly retry: () => void
    }
}

/** What the sign-out-others command needs. */
type OthersActionProps = {
    readonly base: AccountSessionsBaseProps
    readonly isSkeleton: boolean
}

/** The command that signs every other device out, at the end of the card's label row. */
const OthersAction = (props: OthersActionProps) => (
    <Button
        isLoading={props.isSkeleton}
        intent="destructive"
        step="entry"
        size="sm"
        isPending={props.base.props.busy === "others"}
        onPress={props.base.on.signOutOthers}
    >
        {props.base.props.signOutOthersLabel}
    </Button>
)

/** The rows: the device with its glyph, the current mark, the facts, and the one sign-out command each. */
const rowsOf = (props: AccountSessionsBaseProps, rows: ReadonlyArray<SessionRowView>): ReadonlyArray<ListRowData> =>
    rows.map((row) => ({
        id: row.id,
        title: row.device,
        description: row.facts,
        leading: { icon: nivoIconSource(row.isPhone ? "phone" : "device", "leading") },
        ...(row.isCurrent
            ? { badges: [{ label: props.props.currentLabel, tone: "accent", isDot: true }] as const }
            : {}),
        action: {
            label: props.props.signOutLabel,
            intent: row.isCurrent ? ("neutral" as const) : ("alternative" as const),
            isPending: props.props.busy === (row.isCurrent ? "this" : row.id),
            press: row.isCurrent ? props.on.signOutThis : () => props.on.askRevoke(row.id),
        },
    }))

/** The confirmation of signing one other device out: it says which device and what follows. */
const RevokeDialog = (props: AccountSessionsBaseProps) => {
    const confirm = props.props.confirm
    if (confirm === undefined) return null
    return (
        <AlertDialog
            isOpen
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.cancelRevoke()
            }}
            title={confirm.title}
            description={confirm.body}
            tone="negative"
            cancelLabel={confirm.cancelLabel}
            confirmLabel={props.props.signOutLabel}
            isConfirmPending={props.props.busy === confirm.id}
            onConfirm={() => props.on.revoke(confirm.id)}
        />
    )
}

/** Draws the signed-in devices as one card under its label with the count: the rows, the sign-out commands and the note. */
export const AccountSessionsBase = (props: AccountSessionsBaseProps) => (
    <>
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.labels}
            onRetry={props.on.retry}
            render={(rows, isSkeleton) => (
                <>
                    <SurfaceCard
                        kind="list"
                        label={isSkeleton ? props.props.title : `${props.props.title} · ${rows.length}`}
                        headingLevel={2}
                        isLoading={isSkeleton}
                        {...(rows.some((row) => !row.isCurrent)
                            ? { labelEnd: <OthersAction base={props} isSkeleton={isSkeleton} /> }
                            : {})}
                        footer={
                            <Text size="sm" tone="muted">
                                {props.props.hint}
                            </Text>
                        }
                        empty={<EmptyNotice message={props.props.labels.empty} />}
                        items={rowsOf(props, rows)}
                    />
                    <FormNotice failTitle={props.props.failTitle} error={props.props.error} done={props.props.done} />
                </>
            )}
        />
        <RevokeDialog {...props} />
    </>
)
