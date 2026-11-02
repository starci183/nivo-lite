import type { ReactNode } from "react"
import { Drawer } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { SlotRead, AgentOption, DataSlot, Provider, ProviderKind, SlotLabels } from "@/modules/types"
import { CsvImportWizard } from "@/components/blocks/CsvImportWizard"
import { DatabaseWizard } from "@/components/blocks/DatabaseWizard"
import { DriveWizard } from "@/components/blocks/DriveWizard"
import { GoogleWizard } from "@/components/blocks/GoogleWizard"
import { ImapWizard } from "@/components/blocks/ImapWizard"
import { MetaWizard } from "@/components/blocks/MetaWizard"
import { MoneyWizard } from "@/components/blocks/MoneyWizard"
import { OpenApiWizard } from "@/components/blocks/OpenApiWizard"
import { SmtpWizard } from "@/components/blocks/SmtpWizard"
import { TelegramUserWizard } from "@/components/blocks/TelegramUserWizard"
import { TelegramWizard } from "@/components/blocks/TelegramWizard"
import { WebhookWizard } from "@/components/blocks/WebhookWizard"
import { ZaloWizard } from "@/components/blocks/ZaloWizard"

/** The wizard the URL asks for. */
export interface WizardTargetView {
    readonly provider: Provider
    readonly kind: ProviderKind
    /** The connection the wizard continues or edits; absent for a new one. */
    readonly resumeId?: string
    /** The state an OAuth login (Zalo, Meta) came back with. */
    readonly returned?: string
    /** The money provider when the wizard is a bank or payment feed. */
    readonly money: "sepay" | "payos" | "casso" | null
}

/** What the wizards are offered once the workspace reads are in. */
export interface WizardBoard {
    /** Every workspace agent (the data wizards offer all of them). */
    readonly agents: ReadonlyArray<AgentOption>
    /** The agents whose module may use this provider. */
    readonly eligible: ReadonlyArray<AgentOption>
    /** The workspace already has a default SMTP sender. */
    readonly hasDefaultSender: boolean
}

/** The board the drawer draws a placeholder for while the workspace reads are on their way. */
const BOARD_PLACEHOLDER: WizardBoard = { agents: [], eligible: [], hasDefaultSender: false }

/** The drawer and the wizard inside it. */
export interface ConnectionWizardOverlayBaseProps {
    readonly props: {
        readonly title: string
        readonly closeLabel: string
        readonly ownerEmail: string
        readonly target: WizardTargetView | null
        /** The agents and sender the wizards are offered, read from the workspace. */
        readonly dependencyReads: ReadonlyArray<SlotRead<unknown>>
        readonly board: DataSlot<WizardBoard>
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
        /** `changed` is true when something may have been saved, so the page refreshes. */
        readonly close: (changed: boolean) => void
    }
}

/** What every data-connector wizard takes. */
interface DataWizardProps {
    readonly dependencyReads: ReadonlyArray<SlotRead<unknown>>
    readonly agents: ReadonlyArray<AgentOption>
    readonly resumeId?: string
    readonly onClose: (changed: boolean) => void
}

/** The data-connector wizard of each data provider. */
const DATA_WIZARDS: Readonly<Partial<Record<Provider, (props: DataWizardProps) => ReactNode>>> = {
    openapi: OpenApiWizard,
    database: DatabaseWizard,
    csv_import: CsvImportWizard,
    imap: ImapWizard,
    telegram_user: TelegramUserWizard,
}

/** What the data wizard switch takes: the wizard props and the data provider to set up. */
interface DataWizardSwitchProps extends DataWizardProps {
    readonly provider: Provider
}

/** The wizard of one data provider, or nothing for a provider without one. */
const DataWizard = (props: DataWizardSwitchProps) => {
    const Wizard = DATA_WIZARDS[props.provider]
    if (Wizard === undefined) return null
    return (
        <Wizard
            agents={props.agents}
            onClose={props.onClose}
            dependencyReads={props.dependencyReads}
            {...(props.resumeId === undefined ? {} : { resumeId: props.resumeId })}
        />
    )
}

/** What the wizard of one kind is handed: the open target, the board and the way out. */
interface KindWizardProps {
    readonly dependencyReads: ReadonlyArray<SlotRead<unknown>>
    readonly target: WizardTargetView
    readonly board: WizardBoard
    readonly ownerEmail: string
    readonly onClose: (changed: boolean) => void
}

/** The wizard of each kind of provider; the key keeps a resumed connection apart from a new one. */
const KIND_WIZARDS: Readonly<Record<ProviderKind, (props: KindWizardProps) => ReactNode>> = {
    money: ({ target, board, onClose, dependencyReads }) =>
        target.money === null ? null : (
            <MoneyWizard
                key={target.resumeId ?? "new"}
                provider={target.money}
                resumeId={target.resumeId}
                agents={board.eligible}
                onClose={onClose}
                dependencyReads={dependencyReads}
            />
        ),
    telegram: ({ board, onClose, dependencyReads }) => (
        <TelegramWizard agents={board.eligible} onClose={onClose} dependencyReads={dependencyReads} />
    ),
    data: ({ target, board, onClose, dependencyReads }) => (
        <DataWizard
            key={target.resumeId ?? "new"}
            provider={target.provider}
            agents={board.agents}
            {...(target.resumeId === undefined ? {} : { resumeId: target.resumeId })}
            onClose={onClose}
            dependencyReads={dependencyReads}
        />
    ),
    zalo: ({ target, board, onClose, dependencyReads }) => (
        <ZaloWizard
            key={target.resumeId ?? "new"}
            resumeId={target.resumeId}
            returned={target.returned}
            agents={board.eligible}
            onClose={onClose}
            dependencyReads={dependencyReads}
        />
    ),
    meta: ({ target, board, onClose, dependencyReads }) => (
        <MetaWizard
            key={target.resumeId ?? "new"}
            resumeId={target.resumeId}
            returned={target.returned}
            agents={board.eligible}
            onClose={onClose}
            dependencyReads={dependencyReads}
        />
    ),
    webhook: ({ onClose, dependencyReads }) => <WebhookWizard onClose={onClose} dependencyReads={dependencyReads} />,
    google: ({ onClose, dependencyReads }) => <GoogleWizard onClose={onClose} dependencyReads={dependencyReads} />,
    drive: ({ onClose, dependencyReads }) => <DriveWizard onClose={onClose} dependencyReads={dependencyReads} />,
    email: ({ board, ownerEmail, onClose, dependencyReads }) => (
        <SmtpWizard
            ownerEmail={ownerEmail}
            hasDefault={board.hasDefaultSender}
            onClose={onClose}
            dependencyReads={dependencyReads}
        />
    ),
}

/** The actual selected wizard joins its dependencies with its own read and draws its ready tree. */
interface WizardBodyProps {
    readonly wizard: KindWizardProps | null
}
const WizardBody = (props: WizardBodyProps) =>
    props.wizard === null ? null : <>{KIND_WIZARDS[props.wizard.target.kind](props.wizard)}</>

/** The wizard drawer of every provider: one Drawer, one wizard chosen by the provider's kind. */
export const ConnectionWizardOverlayBase = (props: ConnectionWizardOverlayBaseProps) => {
    const wizard = props.props
    const target = wizard.target
    const onClose = props.on.close
    return (
        <Drawer
            isOpen={target !== null}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose(true)
            }}
            title={wizard.title}
            closeLabel={wizard.closeLabel}
            placement="right"
        >
            <SlotView
                slot={wizard.board}
                placeholder={BOARD_PLACEHOLDER}
                labels={wizard.slotLabels}
                onRetry={props.on.retry}
                render={(board) => (
                    <WizardBody
                        wizard={
                            target === null
                                ? null
                                : {
                                      target,
                                      board,
                                      dependencyReads: wizard.dependencyReads,
                                      ownerEmail: wizard.ownerEmail,
                                      onClose,
                                  }
                        }
                    />
                )}
            />
        </Drawer>
    )
}
