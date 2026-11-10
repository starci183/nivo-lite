import { useState } from "react"
import { AlertDialog, Button, EmptyNotice, SurfaceCard } from "@starci/grammar/common"
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
        /** The words of the pager under the devices. */
        readonly paging: {
            readonly nav: string
            readonly previous: string
            readonly next: string
        }
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
        readonly pageLabel: (page: number) => string
        readonly pageSummary: (from: number, to: number, total: number) => string
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

/** The command that signs every other device out, in the foot of the card. */
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

/** How many devices one page of the list holds. */
const PAGE_SIZE = 8

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

/** What the devices card draws. */
type DevicesCardProps = {
    readonly base: AccountSessionsBaseProps
    readonly rows: ReadonlyArray<SessionRowView>
    readonly isSkeleton: boolean
}

/** The devices as one list card: the count beside the label, a pager when they do not fit one page, and the sign-out-others command in the foot. */
const DevicesCard = (props: DevicesCardProps) => {
    const [page, setPage] = useState(1)
    const { rows, base } = props
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    const current = Math.min(page, pageCount)
    const from = (current - 1) * PAGE_SIZE
    const paging = base.props.paging
    return (
        <SurfaceCard
            kind="list"
            label={base.props.title}
            headingLevel={2}
            isLoading={props.isSkeleton}
            {...(props.isSkeleton ? {} : { fact: String(rows.length) })}
            note={base.props.hint}
            empty={<EmptyNotice message={base.props.labels.empty} />}
            items={rowsOf(base, rows.slice(from, from + PAGE_SIZE))}
            footers={[
                ...(pageCount > 1
                    ? [
                          {
                              kind: "paging" as const,
                              page: current,
                              pageCount,
                              onPage: setPage,
                              labels: {
                                  nav: paging.nav,
                                  previous: paging.previous,
                                  next: paging.next,
                                  page: base.on.pageLabel,
                                  summary: base.on.pageSummary(from + 1, Math.min(rows.length, from + PAGE_SIZE), rows.length),
                              },
                          },
                      ]
                    : []),
                ...(rows.some((row) => !row.isCurrent)
                    ? [
                          {
                              kind: "custom" as const,
                              children: <OthersAction base={base} isSkeleton={props.isSkeleton} />,
                          },
                      ]
                    : []),
            ]}
        />
    )
}

/** Draws the signed-in devices as one card under its label with the count: the rows, the pager, the sign-out commands and the note. */
export const AccountSessionsBase = (props: AccountSessionsBaseProps) => (
    <>
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.labels}
            onRetry={props.on.retry}
            render={(rows, isSkeleton) => (
                <>
                    <DevicesCard base={props} rows={rows} isSkeleton={isSkeleton} />
                    <FormNotice failTitle={props.props.failTitle} error={props.props.error} done={props.props.done} />
                </>
            )}
        />
        <RevokeDialog {...props} />
    </>
)
