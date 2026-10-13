import { Badge, Button, Heading, List, ListItem, SurfaceCard, Text } from "@starci/grammar/common"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import {
    ACTIONS_CLASS_NAME,
    CARD_CLASS_NAME,
    CHIPS_CLASS_NAME,
    COPY_CLASS_NAME,
    GRID_CLASS_NAME,
    HEAD_CLASS_NAME,
} from "./classNames"

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
    readonly billingHref?: string
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
    <List className={GRID_CLASS_NAME} label={props.props.label}>
        {props.props.rows.map((row) => (
            <ListItem key={row.id}>
                <SurfaceCard ariaLabel={row.name} height="fill">
                    <div className={CARD_CLASS_NAME}>
                        <div className={HEAD_CLASS_NAME}>
                            <PersonAvatar name={row.name} size="lg" />
                            <div className={COPY_CLASS_NAME}>
                                <Heading level={2}>{row.name}</Heading>
                                <Text size="sm" tone="muted">
                                    {row.roleLabel}
                                </Text>
                            </div>
                        </div>
                        <div className={CHIPS_CLASS_NAME}>
                            <Badge tone={row.stateTone} isDot>
                                {row.stateLabel}
                            </Badge>
                        </div>
                        <div className={ACTIONS_CLASS_NAME}>
                            <Button
                                variant={row.isPrimary ? "primary" : "secondary"}
                                isDisabled={!row.canOpen}
                                isPending={row.isOpening}
                                onPress={() => props.on.open(row.id)}
                            >
                                {row.actionLabel}
                            </Button>
                            {row.billingHref === undefined ? null : (
                                <Button variant="ghost" href={row.billingHref}>
                                    {props.props.billingLabel}
                                </Button>
                            )}
                        </div>
                    </div>
                </SurfaceCard>
            </ListItem>
        ))}
    </List>
)
