import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AlertDialog, Badge, Cluster, Stack, SurfaceCard, Text, type DropdownMenuEntry } from "@starci/grammar/common"
import { AgentRemoveImpact } from "@/components/composites/AgentRemoveImpact"
import { AgentMark } from "@/components/leaves/AgentMark"
import type { AgentCatalogBaseProps, AgentRowView } from "./types"

/** What one figure of the foot of a card shows. */
interface FigureProps {
    readonly label: string
    readonly value: number | null
    readonly noCount: string
    /** A count above zero is work waiting for the owner: a pink chip. */
    readonly isAttention: boolean
}

/** One figure of the foot of a card: its label, and its value. */
const Figure = (props: FigureProps) => (
    <Stack gap="identity">
        <Text size="xs" tone="muted">
            {props.label}
        </Text>
        {props.isAttention && props.value !== null && props.value > 0 ? (
            <Badge tone="accent">{String(props.value)}</Badge>
        ) : (
            <Text isStrong>{props.value === null ? props.noCount : String(props.value)}</Text>
        )}
    </Stack>
)

/** The channels an agent speaks through, each provider once ("Telegram" for two Telegram bots). */
const brandsOf = (row: AgentRowView): ReadonlyArray<string> => [...new Set(row.grants.map((grant) => grant.brand))]

/** What one card of the team needs: the copy and the agent. */
interface AgentCardProps extends AgentCatalogBaseProps {
    readonly row: AgentRowView
    readonly isLoading: boolean
}

/** The commands of the ⋯ menu of a card: open it, add one of its role, pause or resume it, remove it (asked first). */
const menuEntriesOf = (props: AgentCardProps): ReadonlyArray<DropdownMenuEntry> => {
    const { row } = props
    const view = props.props
    return [
        { id: "open", label: view.openLabel, onAction: () => props.on.open(row.href) },
        ...(row.canAddSame ? [{ id: "add", label: view.addLabel, onAction: () => props.on.add(row.roleKey) }] : []),
        ...(row.liveAction === "none"
            ? []
            : [
                  {
                      id: "live",
                      label: row.liveAction === "pause" ? view.pauseLabel : view.resumeLabel,
                      onAction: () => props.on.setLive(row.key, row.liveAction === "resume"),
                  },
              ]),
        { id: "remove", label: view.removeLabel, onAction: () => props.on.askRemove({ key: row.key, name: row.name }) },
    ]
}

/** One agent as a card, the whole card a link to it: who it is and whether it runs, its role and channels, then its two figures under one full-width line. */
export const AgentCard = (props: AgentCardProps) => {
    const { row } = props
    const view = props.props
    return (
        <SurfaceCard
            kind="body"
            ariaLabel={row.name}
            height="fill"
            isLoading={props.isLoading}
            wholeAction={{ kind: "link", href: row.href, label: row.name }}
            menu={{ label: row.menuLabel, entries: menuEntriesOf(props) }}
            footers={[
                {
                    kind: "custom",
                    children: (
                        <Cluster gap="section" wrap={false}>
                            <Figure label={view.tasksLabel} value={row.tasks7d} noCount={view.noCount} isAttention={false} />
                            <Figure label={view.waitingLabel} value={row.waiting} noCount={view.noCount} isAttention />
                        </Cluster>
                    ),
                },
            ]}
        >
            <Stack gap="section">
                <Cluster gap="row" justify="between" wrap={false}>
                    <Cluster gap="inline" wrap={false}>
                        <AgentMark
                            label={row.name}
                            seed={row.seed}
                            src={row.isInitials ? null : row.picture}
                            size="md"
                        />
                        <Stack gap="identity">
                            <Text isStrong>{row.name}</Text>
                            <Text size="xs" tone="muted">
                                {row.subtitle}
                            </Text>
                        </Stack>
                    </Cluster>
                    <Badge tone={row.statusTone} isDot>
                        {row.statusLabel}
                    </Badge>
                </Cluster>
                <Cluster gap="inline">
                    <Badge tone="neutral">{row.roleName}</Badge>
                    {brandsOf(row).map((brand) => (
                        <Badge key={brand} tone="info">
                            {brand}
                        </Badge>
                    ))}
                    {row.missingLabels.map((label) => (
                        <Badge key={label} tone="danger">
                            {label}
                        </Badge>
                    ))}
                </Cluster>
            </Stack>
        </SurfaceCard>
    )
}

/** The sentences while they are read: three lines, so the dialog keeps the height of its plain confirmation. */
const IMPACT_PLACEHOLDER: ReadonlyArray<string> = [" ", " ", " "]

/** What the removal confirmation needs. */
export interface RemoveConfirmProps {
    readonly props: AgentCatalogBaseProps["props"]
    readonly on: AgentCatalogBaseProps["on"]
}

/** The confirmation of a removal: what stops and what stays, then the one destructive command. */
export const RemoveConfirm = (props: RemoveConfirmProps) =>
    props.props.removing === null ? null : (
        <AlertDialog
            isOpen
            onOpenChange={(isOpen) => (isOpen ? undefined : props.on.askRemove(null))}
            title={props.props.removing.title}
            tone="negative"
            confirmLabel={props.props.removeConfirm}
            cancelLabel={props.props.removeCancel}
            isConfirmPending={props.props.isBusy}
            isConfirmDisabled={!("items" in props.props.removeImpact)}
            onConfirm={() => props.on.confirmRemove(props.props.removing?.key ?? "")}
        >
            <SlotView
                slot={props.props.removeImpact}
                placeholder={IMPACT_PLACEHOLDER}
                labels={props.props.removeImpactLabels}
                errorLayout="band"
                onRetry={props.on.retryImpact}
                render={(lines) => <AgentRemoveImpact lines={lines} />}
            />
        </AlertDialog>
    )

