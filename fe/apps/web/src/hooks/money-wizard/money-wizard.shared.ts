import { VN_BANK_CODES } from "@/hooks/banks"
import type { GuideContext } from "@/hooks/connection-guides"
import type { PROVIDERS } from "@/hooks/connection-providers"
import { resumeNoteOf } from "@/hooks/connection-wizard"
import type { useFirstEvent } from "@/hooks/connections"
import type { useQueryMoneyConnectionSwr } from "@/hooks/swr"
import type { Environment, MoneyProvider, WizardConnection, WizardNote } from "@/modules/types"
import type { MoneyWizardInput, NavInput1 } from "./useMoneyWizard"

/** The steps of the bank and payment wizard, in order. */
export const MONEY_STEPS = ["env", "account", "follow", "verify", "agent"] as const

/** The least length of a key the owner pastes from a provider. */
const MIN_KEY_LENGTH = 8

/** The webhook name shown on the provider is "NIVO · <connection name>"; editing it edits the connection name. */
const WEBHOOK_PREFIX = "NIVO · "

/** The account the owner types; the account number is never sent back, so it is blank once the connection exists. */
export interface AccountForm {
    readonly environment: Environment
    readonly name: string
    readonly bank: string
    readonly account: string
    readonly holder: string
}

/** What the follow-along step edits: the webhook name and SePay key NIVO owns, and the keys pasted from the provider. */
export interface FollowDraft {
    readonly webhookName: string
    readonly apiKey: string
    readonly values: Readonly<Record<string, string>>
    readonly keysSaved: boolean
}

/** The name a provider's webhook screen shows for a connection. */
export const webhookNameOf = (name: string): string => `${WEBHOOK_PREFIX}${name}`

/** The connection name behind an edited webhook name. */
export const connectionNameOf = (webhookName: string): string =>
    webhookName
        .trim()
        .replace(/^NIVO\s*·\s*/u, "")
        .trim()

/** The bank list as the select draws it. */
export const bankOptions = (
    bankName: (code: string) => string,
): ReadonlyArray<{ readonly id: string; readonly label: string }> =>
    VN_BANK_CODES.map((code) => ({ id: code, label: `${bankName(code)} (${code})` }))

/** What the wizard knows, to fill into the provider's copy values. */
export const moneyContextOf = (form: AccountForm, conn: WizardConnection | null): GuideContext => ({
    name: conn === null ? form.name : conn.name,
    webhookUrl: conn === null ? "" : conn.webhookUrl,
    apiKey: conn === null ? "" : conn.apiKey,
    bank: conn !== null && conn.bank !== "" ? conn.bank : form.bank,
    account: conn !== null && conn.account !== "" ? conn.account : form.account,
})

/** One provider of the registry. */
type ProviderDef = (typeof PROVIDERS)[MoneyProvider]

/** Which parts of the wizard have unsaved edits, and whether the provider keys are in. */
export interface MoneyFlags {
    readonly accountDirty: boolean
    readonly followDirty: boolean
    readonly needsKeys: boolean
    readonly keysFilled: boolean
    /** Nothing left to save on the follow-along step. */
    readonly keysDone: boolean
}

/** Derives the flags from what the owner typed against what is stored. */
export const moneyFlagsOf = (
    def: ProviderDef,
    form: AccountForm,
    follow: FollowDraft,
    conn: WizardConnection | null,
): MoneyFlags => {
    const needsKeys = def.credentials.length > 0
    const sepayKeyChanged = def.id === "sepay" && conn !== null && follow.apiKey.trim() !== conn.apiKey
    const accountDirty =
        conn !== null &&
        (form.environment !== conn.environment ||
            form.name.trim() !== conn.name ||
            form.bank !== conn.bankCode ||
            form.holder.trim().toUpperCase() !== conn.holder ||
            form.account.trim() !== "")
    return {
        accountDirty,
        followDirty: conn !== null && (connectionNameOf(follow.webhookName) !== conn.name || sepayKeyChanged),
        needsKeys,
        keysFilled: def.credentials.every((key) => (follow.values[key] ?? "").trim().length >= MIN_KEY_LENGTH),
        keysDone: !needsKeys || (follow.keysSaved && !Object.values(follow.values).some(Boolean)),
    }
}
/** The resolved inputs for money wizard view input. */
interface MoneyWizardViewInput {
    readonly nav: NavInput1
    readonly step: (typeof MONEY_STEPS)[number]
    readonly input: MoneyWizardInput
    readonly resume: ReturnType<typeof useQueryMoneyConnectionSwr>
    readonly form: AccountForm
    readonly conn: WizardConnection | null
    readonly follow: FollowDraft
    readonly note: WizardNote | null
    readonly agentIds: readonly string[]
    readonly isPending: boolean
    readonly received: boolean
    readonly watch: ReturnType<typeof useFirstEvent>
    readonly flags: MoneyFlags
    readonly go: (to: number) => void
    readonly create: () => void
    readonly followDone: () => void
    readonly finish: () => void
    readonly setNote: import("react").Dispatch<import("react").SetStateAction<WizardNote | null>>
    readonly setNav: import("react").Dispatch<import("react").SetStateAction<{ index: number; skipped: boolean }>>
    readonly setForm: import("react").Dispatch<import("react").SetStateAction<AccountForm>>
    readonly setFollow: import("react").Dispatch<import("react").SetStateAction<FollowDraft>>
    readonly setAgentIds: import("react").Dispatch<import("react").SetStateAction<ReadonlyArray<string>>>
}

/** Assembles the resolved domain state and commands for its drawing. */
export const viewOf = ({
    nav,
    step,
    input,
    resume,
    form,
    conn,
    follow,
    note,
    agentIds,
    isPending,
    received,
    watch,
    flags,
    go,
    create,
    followDone,
    finish,
    setNote,
    setNav,
    setForm,
    setFollow,
    setAgentIds,
}: MoneyWizardViewInput) => {
    return {
        index: nav.index,
        step,
        isLoading: input.resumeId !== undefined && resume.data === undefined && resume.error === undefined,
        form,
        conn,
        follow,
        note: resumeNoteOf(note, resume.error),
        agentIds,
        isPending,
        received,
        firstEvent: watch.event ?? (conn === null ? null : conn.firstEvent),
        hasCheckFailed: watch.failed,
        hasSkipped: nav.skipped,
        flags,
        context: moneyContextOf(form, conn),
        on: {
            go,
            create,
            followDone,
            finish,
            skip: () => {
                setNote(null)
                setNav((current) => ({ ...current, index: 4, skipped: true }))
            },
            close: () => input.onClose(conn !== null),
            environment: (environment: Environment) => setForm((current) => ({ ...current, environment })),
            name: (name: string) => setForm((current) => ({ ...current, name })),
            bank: (bank: string) => setForm((current) => ({ ...current, bank })),
            account: (account: string) => setForm((current) => ({ ...current, account })),
            holder: (holder: string) => setForm((current) => ({ ...current, holder })),
            edit: (token: string, value: string) =>
                setFollow((current) =>
                    token === "webhookName" ? { ...current, webhookName: value } : { ...current, apiKey: value },
                ),
            paste: (field: string, value: string) =>
                setFollow((current) => ({ ...current, values: { ...current.values, [field]: value } })),
            agents: setAgentIds,
        },
    }
}
