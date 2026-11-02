import { Badge, Button, Cluster, Grid, Heading, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"

/** One workspace card, already worded for the person's language. */
export interface WorkspaceRowView {
    readonly id: string
    readonly name: string
    readonly roleLabel: string
    readonly stateLabel: string
    readonly stateTone: "success" | "warning" | "neutral"
    readonly actionLabel: string
    /** Opening is for people who can: the owner pays an unpaid workspace, nobody else opens it. */
    readonly canOpen: boolean
    readonly isPrimary: boolean
    readonly isOpening: boolean
    /** Where the billing link leads; none when the person manages no billing here. */
    readonly billingHref?: string | undefined
}

/** Copy and rows the connected workspace list supplies. */
export interface WorkspacesListBaseProps {
    readonly props: {
        readonly label: string
        readonly billingLabel: string
        readonly rows: ReadonlyArray<WorkspaceRowView>
    }
    readonly on: { readonly open: (id: string) => void }
}

/** Draws the workspaces the person belongs to as a grid of cards: name, role, state, and the way in. */
export const WorkspacesListBase = (props: WorkspacesListBaseProps) => (
    <Section title={props.props.label}>
        <Grid kind="cards" columns={2}>
            {props.props.rows.map((row) => (
                <SurfaceCard key={row.id} ariaLabel={row.name} height="fill">
                    <Stack gap="row">
                        <Cluster gap="row">
                            <PersonAvatar name={row.name} size="lg" />
                            <Stack gap="identity">
                                <Heading level={3}>{row.name}</Heading>
                                <Text size="sm" tone="muted">
                                    {row.roleLabel}
                                </Text>
                            </Stack>
                        </Cluster>
                        <Cluster gap="inline">
                            <Badge tone={row.stateTone} isDot>
                                {row.stateLabel}
                            </Badge>
                        </Cluster>
                        <Cluster gap="row">
                            <Button
                                intent={row.isPrimary ? "alternative" : "neutral"}
                                isDisabled={!row.canOpen}
                                isPending={row.isOpening}
                                onPress={() => props.on.open(row.id)}
                            >
                                {row.actionLabel}
                            </Button>
                            {row.billingHref === undefined ? null : (
                                <Button intent="neutral" href={row.billingHref}>
                                    {props.props.billingLabel}
                                </Button>
                            )}
                        </Cluster>
                    </Stack>
                </SurfaceCard>
            ))}
        </Grid>
    </Section>
)
