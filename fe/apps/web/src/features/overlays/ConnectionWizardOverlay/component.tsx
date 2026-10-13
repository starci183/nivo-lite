import type { ReactNode } from "react"
import { Drawer } from "@starci/grammar/common"
import { CsvImportWizard } from "@/components/blocks/CsvImportWizard"
import { DatabaseWizard } from "@/components/blocks/DatabaseWizard"
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
import type { AgentOption, Provider, ProviderKind } from "@/modules/types"

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

/** The drawer and the wizard inside it. */
export interface ConnectionWizardOverlayBaseProps {
    readonly props: {
        readonly title: string
        readonly closeLabel: string
        readonly ownerEmail: string
        readonly target: WizardTargetView | null
        /** Every workspace agent (the data wizards offer all of them). */
        readonly agents: ReadonlyArray<AgentOption>
        /** The agents whose module may use this provider. */
        readonly eligible: ReadonlyArray<AgentOption>
        /** The workspace already has a default SMTP sender. */
        readonly hasDefaultSender: boolean
    }
    readonly on: {
        /** `changed` is true when something may have been saved, so the page refreshes. */
        readonly close: (changed: boolean) => void
    }
}

/** What every data-connector wizard takes. */
interface DataWizardProps {
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
            {...(props.resumeId === undefined ? {} : { resumeId: props.resumeId })}
        />
    )
}

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
            {target?.kind === "money" && target.money !== null ? (
                <MoneyWizard
                    key={target.resumeId ?? "new"}
                    provider={target.money}
                    resumeId={target.resumeId}
                    agents={wizard.eligible}
                    onClose={onClose}
                />
            ) : null}
            {target?.kind === "telegram" ? <TelegramWizard agents={wizard.eligible} onClose={onClose} /> : null}
            {target?.kind === "data" ? (
                <DataWizard
                    key={target.resumeId ?? "new"}
                    provider={target.provider}
                    agents={wizard.agents}
                    {...(target.resumeId === undefined ? {} : { resumeId: target.resumeId })}
                    onClose={onClose}
                />
            ) : null}
            {target?.kind === "zalo" ? (
                <ZaloWizard
                    key={target.resumeId ?? "new"}
                    resumeId={target.resumeId}
                    returned={target.returned}
                    agents={wizard.eligible}
                    onClose={onClose}
                />
            ) : null}
            {target?.kind === "meta" ? (
                <MetaWizard
                    key={target.resumeId ?? "new"}
                    resumeId={target.resumeId}
                    returned={target.returned}
                    agents={wizard.eligible}
                    onClose={onClose}
                />
            ) : null}
            {target?.kind === "webhook" ? <WebhookWizard onClose={onClose} /> : null}
            {target?.kind === "google" ? <GoogleWizard onClose={onClose} /> : null}
            {target?.kind === "email" ? (
                <SmtpWizard ownerEmail={wizard.ownerEmail} hasDefault={wizard.hasDefaultSender} onClose={onClose} />
            ) : null}
        </Drawer>
    )
}
