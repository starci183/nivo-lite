import { Alert, EmptyNotice, Link, PaneSection, Stack } from "@starci/grammar/common"
import { AutomationAccountPicker } from "@/components/composites/AutomationAccountPicker"
import { AutomationGate } from "@/components/composites/AutomationGate"
import { AutomationMessage } from "@/components/composites/AutomationMessage"
import { AutomationSettings } from "@/components/composites/AutomationSettings"
import type { AutomationsBoardView, AutomationsPanesActions, AutomationsPanesCopy, CardView } from "@/modules/types"

/** What the main pane draws: the board, the opened card (none while nothing is open), the panes words, and the commands. */
interface AutomationsDetailBodyProps {
    readonly view: AutomationsBoardView
    readonly isLoading: boolean
    readonly copy: AutomationsPanesCopy
    readonly on: AutomationsPanesActions
    readonly card: CardView | undefined
}

/** The sections of the opened card: what it waits for, the message, the gate, the Google account and the settings. */
interface SectionsProps {
    readonly view: AutomationsBoardView
    readonly on: AutomationsPanesActions
    readonly card: CardView
}

const Sections = (props: SectionsProps) => {
    const { on, card } = props
    const open = props.view.detail
    if (open === undefined) return null
    const trust = open.gate?.trust
    const trustProps = trust === undefined ? {} : { trustOffer: { ...trust, onAnswer: on.answerTrust } }
    return (
        <Stack gap="section">
            {open.frame.awaitingText === undefined ? null : (
                <Alert title={open.frame.awaitingText} tone="informative" />
            )}
            {open.frame.errorText === undefined ? null : <Alert title={open.frame.errorText} tone="negative" />}
            {card.note === undefined ? null : (
                <Alert
                    tone="cautionary"
                    title={card.note.text}
                    {...(card.note.link === undefined
                        ? {}
                        : { description: <Link href={card.note.link.href}>{card.note.link.label}</Link> })}
                />
            )}
            {open.message === undefined ? null : (
                <AutomationMessage
                    {...open.message}
                    onChange={on.changeBody}
                    onEnable={on.enable}
                    onSave={on.saveBody}
                    onCompose={on.compose}
                />
            )}
            {open.gate === undefined ? null : <AutomationGate {...open.gate} {...trustProps} />}
            {card.accounts === undefined ? null : (
                <AutomationAccountPicker {...card.accounts} onPick={(id) => on.pickAccount(card.dataKey, id)} />
            )}
            <AutomationSettings {...open.settings} onChange={on.changeSetting} onSave={on.saveSettings} />
        </Stack>
    )
}

/** The main pane: the sections of the opened automation, or the prompt to open one. */
export const AutomationsDetailBody = (props: AutomationsDetailBodyProps) =>
    props.view.detail === undefined || props.card === undefined ? (
        <PaneSection align="center" grow>
            <EmptyNotice message={props.copy.pickTitle} description={props.copy.pickBody} />
        </PaneSection>
    ) : (
        <PaneSection gap="section" isLoading={props.isLoading}>
            <Sections view={props.view} on={props.on} card={props.card} />
        </PaneSection>
    )
