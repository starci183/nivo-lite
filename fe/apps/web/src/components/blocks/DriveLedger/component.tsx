import { useState } from "react"
import { Alert, Badge, Button, Cluster, Input, Link, PaneSection, Section, Stack, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Where the ledger stands, as the band words it. */
type DriveLedgerState = "none" | "granted" | "ready" | "lost"

/** The ledger as the band draws it once the read is in. */
interface DriveLedgerView {
    readonly state: DriveLedgerState
    /** The sentence of where the ledger stands. */
    readonly status: string
    readonly chip: { readonly label: string; readonly tone: "neutral" | "warning" | "danger" | "success" }
    /** The sheet link or id being typed, or the saved one. */
    readonly sheet: string
    /** The address of the ledger sheet, blank until named. */
    readonly sheetUrl: string
    /** The sheet named by its title, with when the last row was written; the address while the title is unknown. */
    readonly sheetName: string
    /** Who gave the access and when the last row was written, under the sheet name. */
    readonly sheetLine: string
    readonly note: string | null
    readonly error: string | null
    readonly isPending: boolean
}

/** The words of the ledger band. */
export interface DriveLedgerBaseProps {
    readonly props: {
        readonly slot: DataSlot<DriveLedgerView>
        readonly labels: SlotLabels
        readonly copy: Readonly<
            Record<
                | "title"
                | "body"
                | "allow"
                | "allowAgain"
                | "lostTitle"
                | "lostBody"
                | "sheetLabel"
                | "sheetHint"
                | "save"
                | "open"
                | "change",
                string
            >
        >
    }
    readonly on: {
        readonly allow: () => void
        readonly sheet: (value: string) => void
        readonly save: () => void
        readonly retry: () => void
    }
}

/** The geometry of the ready band while the read waits. */
const PLACEHOLDER: DriveLedgerView = {
    state: "none",
    status: "-",
    chip: { label: "-", tone: "neutral" },
    sheet: "",
    sheetUrl: "",
    sheetName: "-",
    sheetLine: "-",
    note: null,
    error: null,
    isPending: false,
}

/** What the body of a state draws. */
interface LedgerBodyProps {
    readonly base: DriveLedgerBaseProps
    readonly view: DriveLedgerView
}

/** The sheet field and its save command: the access is given and a sheet must be named, or the owner changes it. */
const NameSheet = (props: LedgerBodyProps) => (
    <Stack gap="row">
        <Input
            id="drive-ledger-sheet"
            name="ledgerSheet"
            label={props.base.props.copy.sheetLabel}
            description={props.base.props.copy.sheetHint}
            isDisabled={props.view.isPending}
            value={props.view.sheet}
            onValueChange={props.base.on.sheet}
        />
        <Cluster gap="inline">
            <Button intent="neutral" isPending={props.view.isPending} onPress={props.base.on.save}>
                {props.base.props.copy.save}
            </Button>
        </Cluster>
    </Stack>
)

/** The ready ledger: the sheet it writes to, with the way to open it and to change it. */
const ReadySheet = (props: LedgerBodyProps) => {
    const [isChanging, setChanging] = useState(false)
    if (isChanging) return <NameSheet base={props.base} view={props.view} />
    return (
        <Stack gap="row">
            <Text size="sm">{props.view.sheetName}</Text>
            <Text size="xs" tone="muted">
                {props.view.sheetLine}
            </Text>
            <Cluster gap="inline" justify="between">
                <Link kind="external" href={props.view.sheetUrl}>
                    {props.base.props.copy.open}
                </Link>
                <Button intent="neutral" onPress={() => setChanging(true)}>
                    {props.base.props.copy.change}
                </Button>
            </Cluster>
        </Stack>
    )
}

/** The part of the band that depends on where the ledger stands. */
const StateBody = (props: LedgerBodyProps) => {
    const { copy } = props.base.props
    switch (props.view.state) {
        case "granted":
            return <NameSheet base={props.base} view={props.view} />
        case "ready":
            return <ReadySheet base={props.base} view={props.view} />
        case "lost":
            return (
                <Stack gap="row">
                    <Alert
                        tone="negative"
                        title={copy.lostTitle}
                        description={copy.lostBody}
                        action={{ label: copy.allowAgain, onAction: props.base.on.allow }}
                    />
                    <Text size="sm" tone="muted">
                        {props.view.sheetLine === ""
                            ? props.view.sheetName
                            : `${props.view.sheetName} · ${props.view.sheetLine}`}
                    </Text>
                </Stack>
            )
        case "none":
            return (
                <Cluster gap="inline">
                    <Button intent="neutral" isPending={props.view.isPending} onPress={props.base.on.allow}>
                        {copy.allow}
                    </Button>
                </Cluster>
            )
    }
}

/**
 * The ledger kept in a Google spreadsheet, a band of the Drive page: what it does, where it stands (not allowed, allowed without a
 * sheet, writing, access withdrawn) and the one command that moves it on.
 */
export const DriveLedgerBase = (props: DriveLedgerBaseProps) => (
    <PaneSection>
        <SlotView
            slot={props.props.slot}
            placeholder={PLACEHOLDER}
            labels={props.props.labels}
            onRetry={props.on.retry}
            render={(view, isLoading) => (
                <Section
                    title={props.props.copy.title}
                    isLoading={isLoading}
                    action={<Badge tone={view.chip.tone}>{view.chip.label}</Badge>}
                >
                    <Stack gap="row">
                        <Text size="sm" tone="muted">
                            {props.props.copy.body}
                        </Text>
                        <Text size="sm" tone="muted">
                            {view.note ?? view.status}
                        </Text>
                        {view.error === null ? null : <Alert tone="negative" title={view.error} />}
                        <StateBody base={props} view={view} />
                    </Stack>
                </Section>
            )}
        />
    </PaneSection>
)
