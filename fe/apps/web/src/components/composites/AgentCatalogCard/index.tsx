import { Badge, Button, Dialog, Heading, Image, List, ListItem, SurfaceCard, Text } from "@starci/grammar/common"
import { BADGES, BAND, CARD, CARD_HEAD, DETAIL, FOOT, POINTS } from "./classNames"

/** The most capabilities a card lists before the details. */
const CARD_POINTS = 3

/** What one role card of the catalogue shows, already in the reader language. */
export type AgentCatalogCardProps = {
    readonly name: string
    readonly description: string
    readonly points: ReadonlyArray<string>
    readonly mascot: string
    readonly isEarly: boolean
    readonly earlyLabel: string
    readonly earlyHint: string
    /** "Installed" or "Not installed". */
    readonly stateLabel: string
    readonly isInstalled: boolean
    /** The data is not known yet: the state badge and the actions are skeletons. */
    readonly isLoading: boolean
    /** Where the installed agent of this role opens; null when none is installed. */
    readonly openHref: string | null
    readonly detailsLabel: string
    readonly detailsPointsTitle: string
    readonly closeLabel: string
    /** The person may set the agent up. */
    readonly canInstall: boolean
    readonly installLabel: string
    readonly isInstalling: boolean
    /** Another install is running, so this one waits. */
    readonly isBlocked: boolean
    readonly onInstall: () => void
}

/** What the "view details" action reads. */
type DetailsProps = Pick<
    AgentCatalogCardProps,
    | "name"
    | "description"
    | "points"
    | "isEarly"
    | "earlyHint"
    | "isLoading"
    | "openHref"
    | "detailsLabel"
    | "detailsPointsTitle"
    | "closeLabel"
>

/** The "view details" action: the installed agent when there is one, else a dialog with everything the role does. */
const Details = (props: DetailsProps) => {
    if (props.isLoading) {
        return (
            <Button intent="neutral" isSkeleton>
                {props.detailsLabel}
            </Button>
        )
    }
    if (props.openHref !== null) {
        return (
            <Button intent="neutral" href={props.openHref}>
                {props.detailsLabel}
            </Button>
        )
    }
    return (
        <Dialog
            size="sm"
            title={props.name}
            description={props.description}
            closeLabel={props.closeLabel}
            trigger={<Button intent="neutral">{props.detailsLabel}</Button>}
        >
            <div className={DETAIL}>
                <Heading level={3}>{props.detailsPointsTitle}</Heading>
                <List label={props.detailsPointsTitle} className={POINTS}>
                    {props.points.map((point) => (
                        <ListItem key={point}>
                            <Text size="sm">{point}</Text>
                        </ListItem>
                    ))}
                </List>
                {props.isEarly ? (
                    <Text size="xs" tone="muted">
                        {props.earlyHint}
                    </Text>
                ) : null}
            </div>
        </Dialog>
    )
}

/** One role of the catalogue: illustration band, name, state badges, one line of description, three capabilities and the two actions. */
export const AgentCatalogCard = (props: AgentCatalogCardProps) => (
    <SurfaceCard ariaLabel={props.name}>
        <div className={CARD}>
            <div className={BAND}>
                <Image src={props.mascot} alt="" aspect="wide" fit="contain" plate="default" />
            </div>
            <div className={CARD_HEAD}>
                <Heading level={3}>{props.name}</Heading>
                <div className={BADGES}>
                    {props.isEarly ? <Badge tone="accent">{props.earlyLabel}</Badge> : null}
                    <Badge isDot isSkeleton={props.isLoading} tone={props.isInstalled ? "success" : "neutral"}>
                        {props.stateLabel}
                    </Badge>
                </div>
            </div>
            <Text size="sm" tone="muted" overflow="truncate">
                {props.description}
            </Text>
            <List label={props.name} className={POINTS}>
                {props.points.slice(0, CARD_POINTS).map((point) => (
                    <ListItem key={point}>
                        <Text size="sm" tone="muted" overflow="truncate">
                            {point}
                        </Text>
                    </ListItem>
                ))}
            </List>
            <div className={FOOT}>
                {props.isLoading ? (
                    <Button intent="alternative" isSkeleton>
                        {props.installLabel}
                    </Button>
                ) : null}
                {!props.isLoading && props.canInstall ? (
                    <Button
                        intent="alternative"
                        isPending={props.isInstalling}
                        isDisabled={props.isBlocked}
                        onPress={props.onInstall}
                    >
                        {props.installLabel}
                    </Button>
                ) : null}
                <Details
                    name={props.name}
                    description={props.description}
                    points={props.points}
                    isEarly={props.isEarly}
                    earlyHint={props.earlyHint}
                    isLoading={props.isLoading}
                    openHref={props.openHref}
                    detailsLabel={props.detailsLabel}
                    detailsPointsTitle={props.detailsPointsTitle}
                    closeLabel={props.closeLabel}
                />
            </div>
        </div>
    </SurfaceCard>
)
