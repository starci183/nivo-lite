import { Badge, DropdownMenu, IconButton, Switch } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { AutomationMark } from "@/components/composites/AutomationMark"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { AutomationsBoardView, AutomationsPanesActions, AutomationsPanesView, CardView } from "@/modules/types"

/** What the head of the opened automation draws: the board, the panes words, the opened card, and the commands. */
interface AutomationsDetailHeadProps {
    readonly view: AutomationsBoardView
    readonly isLoading: boolean
    readonly panes: AutomationsPanesView
    readonly on: AutomationsPanesActions
    readonly card: CardView
}

/** The menu of the opened automation: restore it when hidden, else run it now and "not for me". */
const menuOf = (props: AutomationsDetailHeadProps): ReadonlyArray<DropdownMenuEntry> => {
    const open = props.view.detail
    if (open === undefined) return []
    if (open.frame.isHidden) {
        return [{ id: "restore", label: open.frame.restoreLabel, onAction: () => props.on.restore(props.card.dataKey) }]
    }
    return [
        ...(open.runNow === undefined ? [] : [{ id: "run", label: open.runNow.label, onAction: props.on.runNow }]),
        { id: "dismiss", label: open.frame.dismissLabel, onAction: props.on.dismiss },
    ]
}

/** The head band of the opened automation: its mark, name, state, the switch and the menu. */
export const AutomationsDetailHead = (props: AutomationsDetailHeadProps) => {
    const { card } = props
    return (
        <PaneHead
            title={props.view.detail?.frame.name ?? card.name}
            headingLevel={1}
            description={card.triggerLine}
            mark={<AutomationMark icon={card.icon} />}
            status={
                <Badge isDot tone={card.statusTone}>
                    {card.statusLabel}
                </Badge>
            }
            back={{ label: props.panes.copy.back, onPress: props.on.close }}
            isLoading={props.isLoading}
            actions={
                <>
                    <Switch
                        name={card.switchName}
                        label={card.switchLabel}
                        isSelected={card.isEnabled}
                        isDisabled={card.isSwitchDisabled}
                        onSelectedChange={(next) => props.on.toggle(card.dataKey, next)}
                    />
                    <DropdownMenu
                        placement="bottom end"
                        entries={menuOf(props)}
                        trigger={
                            <IconButton
                                intent="neutral"
                                source={nivoIconSource("more", "leading")}
                                label={props.panes.copy.moreActions}
                            />
                        }
                    />
                </>
            }
        />
    )
}
