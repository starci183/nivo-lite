import { Badge, Button, IconTile, Image, ListRow, SurfaceListCard } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** What one role card of the catalogue shows, already in the reader language. */
export type AgentCatalogCardProps = {
    readonly name: string
    readonly description: string
    readonly mascot: string
    readonly isEarly: boolean
    readonly earlyLabel: string
    /** "Installed 1" or "Not installed". */
    readonly stateLabel: string
    readonly isInstalled: boolean
    /** The data is not known yet: the row is a skeleton. */
    readonly isSkeleton: boolean
    /** The person may set an agent up. */
    readonly canInstall: boolean
    readonly installLabel: string
    readonly isInstalling: boolean
    /** Another install is running, so this one waits. */
    readonly isBlocked: boolean
    readonly onInstall: () => void
}

/**
 * One role of the catalogue as a compact card: the small mascot, the name with its state, one line of what it does and the
 * create action on the card itself (pane-free list card: the row owns its inset, the card its edge).
 */
export const AgentCatalogCard = (props: AgentCatalogCardProps) => (
    <SurfaceListCard ariaLabel={props.name}>
        <ListRow
            isSkeleton={props.isSkeleton}
            leading={
                <IconTile
                    source={nivoIconSource("apps", "leading")}
                    artwork={<Image src={props.mascot} alt="" aspect="square" fit="contain" />}
                    size="md"
                />
            }
            title={props.name}
            description={props.description}
            badges={
                <>
                    {props.isEarly ? <Badge tone="accent">{props.earlyLabel}</Badge> : null}
                    <Badge isDot tone={props.isInstalled ? "success" : "neutral"}>
                        {props.stateLabel}
                    </Badge>
                </>
            }
            actions={
                props.canInstall ? (
                    <Button
                        intent="neutral"
                        size="sm"
                        isPending={props.isInstalling}
                        isDisabled={props.isBlocked}
                        onPress={props.onInstall}
                    >
                        {props.installLabel}
                    </Button>
                ) : undefined
            }
        />
    </SurfaceListCard>
)
