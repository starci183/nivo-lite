import { Cluster, Input, Stack, SurfaceCard, Text, type BadgeData, type ListRowData } from "@starci/grammar/common"
import { sandboxCardStateOf } from "@/components/branches/SandboxCardState"
import type { DataSlot, SandboxCaseRowView, SandboxCasesData, SandboxCopy, SandboxPendingView } from "@/modules/types"

/** What the cases card draws and does. */
interface SandboxCasesCardProps {
    readonly copy: SandboxCopy
    readonly slot: DataSlot<SandboxCasesData>
    readonly pending: SandboxPendingView
    readonly on: {
        readonly setInput: (name: string, value: string) => void
        readonly send: (caseId: string) => void
        readonly choose: (caseId: string) => void
        readonly retry: () => void
    }
}

/** The card while its cases are read: three rows of the shape of the real ones, no inputs. */
const PLACEHOLDER: SandboxCasesData = {
    rows: ["a", "b", "c"].map((id) => ({
        id: `case:${id}`,
        label: " ",
        direction: "inbound" as const,
        operation: null,
        isDefault: false,
        isNext: false,
    })),
    fields: [],
    latestLine: null,
    nextLines: [],
}

/** No case at all. */
const NONE: SandboxCasesData = { rows: [], fields: [], latestLine: null, nextLines: [] }

/** The plain Badges a case wears: the default one of an outbound operation, and the one the account answers next. */
const badgesOf = (row: SandboxCaseRowView, copy: SandboxCopy["cases"]): ListRowData["badges"] => {
    const badges: Array<BadgeData> = []
    if (row.isDefault) badges.push({ label: copy.defaultBadge })
    if (row.isNext) badges.push({ label: copy.nextBadge })
    const [first, second] = badges
    if (first === undefined) return undefined
    return second === undefined ? [first] : [first, second]
}

/** One case as a row: its label over its id (and, for an outbound case, what it answers), and its one command: send it, or choose it as the next. */
const rowOf = (row: SandboxCaseRowView, props: SandboxCasesCardProps): ListRowData => {
    const isInbound = row.direction === "inbound"
    const badges = badgesOf(row, props.copy.cases)
    return {
        id: row.id,
        title: row.label,
        description: (
            <Text as="span" size="xs" tone="muted">
                {row.operation === null ? row.id : `${row.id} · ${row.operation}`}
            </Text>
        ),
        ...(badges === undefined ? {} : { badges }),
        actionPlacement: "end",
        action: {
            label: isInbound ? props.copy.cases.sendLabel : props.copy.cases.pickLabel,
            press: () => (isInbound ? props.on.send(row.id) : props.on.choose(row.id)),
            isPending: isInbound ? props.pending.sendingId === row.id : props.pending.choosingId === row.id,
            isDisabled: !isInbound && row.isNext,
        },
    }
}

/** What the header zone draws: the data and the card whose commands it calls. */
interface SandboxCasesHeaderProps {
    readonly data: SandboxCasesData
    readonly card: SandboxCasesCardProps
}

/** The inputs the inbound cases take and the lines that say what the agent asked for last and which case answers next. */
const HeaderFields = (props: SandboxCasesHeaderProps) => (
    <Stack gap="row">
        {props.data.latestLine === null ? null : (
            <Text size="xs" tone="muted">
                {props.data.latestLine}
            </Text>
        )}
        {props.data.nextLines.map((line) => (
            <Text key={line} size="xs" tone="muted">
                {line}
            </Text>
        ))}
        {props.data.fields.length === 0 ? null : (
            <Cluster gap="inline" align="end" label={props.card.copy.cases.inputsLabel}>
                {props.data.fields.map((field) => (
                    <Input
                        key={field.name}
                        id={`sandbox-input-${field.name}`}
                        name={field.name}
                        label={field.label}
                        size="sm"
                        value={field.value}
                        placeholder={field.placeholder}
                        onValueChange={(value) => props.card.on.setInput(field.name, value)}
                    />
                ))}
            </Cluster>
        )}
    </Stack>
)

/**
 * The provider's hardcoded cases of the open account: one row each, its command at the end. The inputs the inbound cases take stand
 * in the header zone, filled from the agent's latest request and editable, with the line that says what that request was; an outbound
 * operation's next case is named in the same zone and marked on its row.
 */
export const SandboxCasesCard = (props: SandboxCasesCardProps) => {
    const state = sandboxCardStateOf(props.slot, PLACEHOLDER, NONE, {
        message: props.copy.cases.errorTitle,
        retryLabel: props.copy.retryLabel,
        onRetry: props.on.retry,
    })
    const hasHeader =
        !state.isLoading &&
        (state.data.fields.length > 0 || state.data.latestLine !== null || state.data.nextLines.length > 0)
    return (
        <SurfaceCard
            kind="list"
            label={props.copy.cases.title}
            headingLevel={2}
            isLoading={state.isLoading}
            {...(state.error === undefined ? {} : { error: state.error })}
            {...(hasHeader
                ? { headers: [{ kind: "custom" as const, children: <HeaderFields data={state.data} card={props} /> }] }
                : {})}
            items={state.data.rows.map((row) => rowOf(row, props))}
            empty={<Text tone="muted">{props.copy.cases.empty}</Text>}
        />
    )
}
