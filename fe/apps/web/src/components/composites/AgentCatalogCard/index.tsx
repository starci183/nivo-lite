import { SurfaceCard, type ItemAction } from "@starci/grammar/common"

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
    readonly isLoading: boolean
    /** The person may set an agent up. */
    readonly canInstall: boolean
    readonly installLabel: string
    readonly isInstalling: boolean
    /** Another install is running, so this one waits. */
    readonly isBlocked: boolean
    readonly onInstall: () => void
}

/**
 * One role of the catalogue as a tile in the roles grid: the mascot and the name inside, the install state and the
 * create action at the bottom of the card.
 */
export const AgentCatalogCard = (props: AgentCatalogCardProps) => (
    <SurfaceCard
        kind="tile"
        name={props.name}
        mark={{ avatar: { name: props.name, kind: "agent", src: props.mascot } }}
        description={props.description}
        badge={{
            label: props.isEarly ? `${props.stateLabel} · ${props.earlyLabel}` : props.stateLabel,
            tone: props.isInstalled ? "success" : "neutral",
            isDot: true,
        }}
        isLoading={props.isLoading === true}
        {...(props.canInstall
            ? {
                  action: {
                      label: props.installLabel,
                      intent: "neutral",
                      isPending: props.isInstalling,
                      isDisabled: props.isBlocked || props.isInstalling,
                      press: props.onInstall,
                  } satisfies ItemAction,
              }
            : {})}
    />
)
