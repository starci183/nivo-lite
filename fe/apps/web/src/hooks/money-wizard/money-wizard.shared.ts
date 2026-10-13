import type { GuideContext } from "@/hooks/connection-guides"
import type { PROVIDERS } from "@/hooks/connection-providers"
import { VN_BANKS } from "@/lib/vn-banks"
import type { DbOutcome } from "@/modules/db/outcome"
import type { Environment, FirstEventState, MoneyProvider, ProviderKeysResult, WizardConnection } from "@/modules/types"

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

/** The commands the connected entry hands the bank and payment wizard (each one already knows the active workspace). */
export interface MoneyActions {
    readonly start: (provider: MoneyProvider, form: AccountForm) => Promise<DbOutcome<WizardConnection>>
    readonly update: (
        connectionId: string,
        form: AccountForm,
        apiKey: string | undefined,
    ) => Promise<DbOutcome<WizardConnection>>
    readonly resume: (connectionId: string) => Promise<DbOutcome<WizardConnection>>
    readonly saveKeys: (
        connectionId: string,
        values: Readonly<Record<string, string>>,
    ) => Promise<DbOutcome<ProviderKeysResult>>
    readonly setAgents: (connectionId: string, agents: ReadonlyArray<string>) => Promise<DbOutcome<true>>
    readonly checkFirstEvent: (connectionId: string) => Promise<DbOutcome<FirstEventState>>
}

/** The name a provider's webhook screen shows for a connection. */
export const webhookNameOf = (name: string): string => `${WEBHOOK_PREFIX}${name}`

/** The connection name behind an edited webhook name. */
export const connectionNameOf = (webhookName: string): string =>
    webhookName
        .trim()
        .replace(/^NIVO\s*·\s*/u, "")
        .trim()

/** The full name of a bank code, or the code when the bank is not listed. */
const bankLabel = (code: string): string => VN_BANKS.find((bank) => bank.code === code)?.name ?? code

/** The bank list as the select draws it. */
export const bankOptions = (): ReadonlyArray<{ readonly id: string; readonly label: string }> =>
    VN_BANKS.map((bank) => ({ id: bank.code, label: `${bank.name} (${bank.code})` }))

/** What the wizard knows, to fill into the provider's copy values. */
export const moneyContextOf = (form: AccountForm, conn: WizardConnection | null): GuideContext => ({
    name: conn === null ? form.name : conn.name,
    webhookUrl: conn === null ? "" : conn.webhookUrl,
    apiKey: conn === null ? "" : conn.apiKey,
    bank: conn !== null && conn.bank !== "" ? conn.bank : bankLabel(form.bank),
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
