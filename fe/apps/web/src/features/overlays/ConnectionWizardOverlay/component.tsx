import { Drawer } from "@starci/grammar/common"
import { GoogleWizard } from "@/features/connections/wizard/GoogleWizard"
import { MetaWizard } from "@/features/connections/wizard/MetaWizard"
import { DataWizard } from "@/features/connections/wizard/data"
import { MoneyWizard } from "@/components/blocks/MoneyWizard"
import { SmtpWizard } from "@/components/blocks/SmtpWizard"
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
        readonly workspaceId: string
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
                    workspaceId={wizard.workspaceId}
                    provider={target.money}
                    resumeId={target.resumeId}
                    agents={wizard.eligible}
                    onClose={onClose}
                />
            ) : null}
            {target?.kind === "telegram" ? (
                <TelegramWizard workspaceId={wizard.workspaceId} agents={wizard.eligible} onClose={onClose} />
            ) : null}
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
                    workspaceId={wizard.workspaceId}
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
            {target?.kind === "webhook" ? <WebhookWizard workspaceId={wizard.workspaceId} onClose={onClose} /> : null}
            {target?.kind === "google" ? <GoogleWizard onClose={onClose} /> : null}
            {target?.kind === "email" ? (
                <SmtpWizard ownerEmail={wizard.ownerEmail} hasDefault={wizard.hasDefaultSender} onClose={onClose} />
            ) : null}
        </Drawer>
    )
}
