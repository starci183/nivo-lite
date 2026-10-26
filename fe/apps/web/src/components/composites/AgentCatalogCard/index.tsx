import { Badge, Button, Heading, Image, List, ListItem, SurfaceCard, Text } from "@starci/grammar/common"
import { ConnectionNeeds, type ConnectionNeedsProps } from "@/components/leaves/ConnectionNeeds"
import { BADGES, CARD, CARD_HEAD, FOOT, POINTS } from "./classNames"

/** The tone of a status badge. */
type CardTone = "neutral" | "accent" | "success" | "warning" | "danger"

/** What one catalogue card shows, already in the reader language. */
export type AgentCatalogCardProps = {
    readonly name: string
    readonly description: string
    readonly points: ReadonlyArray<string>
    readonly mascot: string
    readonly isEarly: boolean
    readonly earlyLabel: string
    readonly earlyHint: string
    readonly statusLabel: string
    readonly statusTone: CardTone
    /** What a `needs_connection` agent waits for and where to connect it; no lines otherwise. */
    readonly needs: ConnectionNeedsProps
    /** The status is not known yet: the badge and the action are skeletons. */
    readonly isLoading: boolean
    /** Where an installed agent opens; null when it is not installed. */
    readonly openHref: string | null
    readonly openLabel: string
    /** The person may set the agent up. */
    readonly canInstall: boolean
    readonly installLabel: string
    readonly isInstalling: boolean
    /** Another install is running, so this one waits. */
    readonly isBlocked: boolean
    readonly onInstall: () => void
}

/** One agent of the catalogue: mascot, name, status, selling points and the one action that fits (open, set up, or none). */
export const AgentCatalogCard = (props: AgentCatalogCardProps) => (
    <SurfaceCard ariaLabel={props.name}>
        <div className={CARD}>
            <Image src={props.mascot} alt="" aspect="wide" fit="contain" plate="none" />
            <div className={CARD_HEAD}>
                <Heading level={3}>{props.name}</Heading>
                <div className={BADGES}>
                    {props.isEarly ? <Badge tone="accent">{props.earlyLabel}</Badge> : null}
                    <Badge isDot isSkeleton={props.isLoading} tone={props.statusTone}>
                        {props.statusLabel}
                    </Badge>
                </div>
            </div>
            <Text size="sm" tone="muted">
                {props.description}
            </Text>
            <ConnectionNeeds {...props.needs} />
            <List label={props.name} className={POINTS}>
                {props.points.map((point) => (
                    <ListItem key={point}>
                        <Text size="sm" tone="muted">
                            {point}
                        </Text>
                    </ListItem>
                ))}
            </List>
            {props.isEarly ? (
                <Text size="xs" tone="muted">
                    {props.earlyHint}
                </Text>
            ) : null}
            <div className={FOOT}>
                {props.isLoading ? (
                    <Button intent="alternative" isSkeleton>
                        {props.openLabel}
                    </Button>
                ) : null}
                {!props.isLoading && props.openHref !== null ? (
                    <Button intent="alternative" href={props.openHref}>
                        {props.openLabel}
                    </Button>
                ) : null}
                {!props.isLoading && props.openHref === null && props.canInstall ? (
                    <Button
                        intent="commit"
                        isPending={props.isInstalling}
                        isDisabled={props.isBlocked}
                        onPress={props.onInstall}
                    >
                        {props.installLabel}
                    </Button>
                ) : null}
            </div>
        </div>
    </SurfaceCard>
)
