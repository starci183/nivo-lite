import type { ConnectionStatus, Environment, FirstEvent, Provider } from "./connections"

/** The tone of a one-line note in a wizard step. */
export type NoteTone = "affirmative" | "negative" | "informative"

/** What a wizard knows once the connection it resumes is read: whether it continues a stored one. */
export interface WizardResume {
    readonly isResumed: boolean
}

/** A sentence under a wizard step, already in the reader's language. */
export interface WizardNote {
    readonly tone: NoteTone
    readonly text: string
}

/** The words of an in-field copy action. */
export interface CopyLabels {
    readonly copy: string
    readonly copied: string
    readonly reveal: string
    readonly hide: string
}

/** One line of a provider screen as the wizard draws it: a value to copy, a box to paste into, a choice, a switch or a note. */
export type GuideField =
    | {
          readonly kind: "copy"
          readonly id: string
          readonly token: string
          readonly label: string
          readonly hint: string
          readonly value: string
          readonly isSecret: boolean
          readonly isEditable: boolean
      }
    | {
          readonly kind: "paste"
          readonly id: string
          readonly field: string
          readonly label: string
          readonly hint: string | undefined
          readonly value: string
          readonly isSecret: boolean
      }
    | {
          readonly kind: "choose"
          readonly id: string
          readonly label: string
          readonly option: string
          readonly hint: string
      }
    | { readonly kind: "switch"; readonly id: string; readonly label: string; readonly hint: string }
    | { readonly kind: "note"; readonly id: string; readonly text: string }

/** One screen of the provider: its heading and the lines the owner mirrors there. */
export interface GuideScreen {
    readonly id: string
    readonly heading: string
    readonly fields: ReadonlyArray<GuideField>
}

/** What the owner does while the first event is awaited: an intro and numbered steps. */
export interface VerifyHelpView {
    readonly intro: string
    readonly steps: ReadonlyArray<string>
}

/** One agent the last step can tick, with what it does through this connection. */
export interface AgentChoice {
    readonly id: string
    readonly name: string
    readonly description: string | undefined
}

/** The bank and payment providers the money wizard connects. */
export type MoneyProvider = "sepay" | "payos" | "casso"

/** A Telegram bot just connected: only the new connection's id matters to the wizard. */
export interface TelegramConnected {
    readonly connection: { readonly id: string }
    readonly webhookRegistered: boolean
}

/** What the money wizard shows of a bank or payment connection; the account number only comes back masked. */
export interface WizardConnection {
    readonly id: string
    readonly provider: Provider
    readonly name: string
    readonly environment: Environment
    readonly status: ConnectionStatus
    readonly webhookUrl: string
    readonly apiKey: string
    readonly bank: string
    readonly bankCode: string
    readonly account: string
    readonly holder: string
    readonly credentialsSaved: boolean
    readonly firstEvent: FirstEvent | null
    readonly agentIds: ReadonlyArray<string>
}

/** What the Zalo wizard shows of an Official Account connection; keys are never returned. */
export interface ZaloWizardConnection {
    readonly id: string
    readonly name: string
    readonly status: ConnectionStatus
    readonly webhookUrl: string
    readonly callbackUrl: string
    readonly authorized: boolean
    readonly oaSecretSaved: boolean
    readonly oaId: string
    readonly firstEvent: FirstEvent | null
    readonly agentIds: ReadonlyArray<string>
}

/** What saving the payOS or Casso keys answers. */
export interface ProviderKeysResult {
    readonly confirmed: boolean
    readonly localOnly: boolean
}

/** The Zalo permission address the browser is sent to. */
export interface ZaloAuthorizeUrl {
    readonly url: string
}

/** The outgoing webhook as the wizard shows it: where it goes, which events, and the signing key to copy. */
export interface WebhookView {
    readonly id: string
    readonly name: string
    readonly host: string
    readonly events: ReadonlyArray<string>
    readonly signingSecret: string
}

/** One choice of a radio list. */
export interface SmtpOption {
    readonly value: string
    readonly label: string
    readonly description: string
}

/** The guide of the chosen way of sending, in the reader's language. */
export interface SmtpGuideView {
    readonly modeLabel: string
    readonly when: string
    /** The prefilled host line; null when the owner types the host. */
    readonly prefilled: string | null
    readonly steps: ReadonlyArray<{
        readonly text: string
        readonly link: { readonly label: string; readonly url: string } | null
    }>
    readonly caution: string | null
}

/** The sender form: what to ask for and the words around each box. */
export interface SmtpAccountView {
    readonly values: {
        readonly fromName: string
        readonly fromEmail: string
        readonly replyTo: string
        readonly user: string
        readonly password: string
    }
    readonly host: string
    readonly port: string
    readonly security: "starttls" | "tls"
    readonly securityOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly showHost: boolean
    readonly showUser: boolean
    readonly showPassword: boolean
    readonly passwordLabel: string
    readonly passwordHint: string | undefined
    readonly fixedUserNote: string | null
    readonly prefilledNote: string | null
}

/** The words of the outgoing-email wizard that are not part of a provider's guide. */
export type SmtpText = Readonly<
    Record<
        | "back"
        | "next"
        | "close"
        | "done"
        | "saveContinue"
        | "testSend"
        | "testSending"
        | "chooseHint"
        | "modeTitle"
        | "stepsTitle"
        | "cautionTitle"
        | "fieldFromName"
        | "fieldFromNameHint"
        | "fieldFromEmail"
        | "fieldFromEmailHint"
        | "fieldReplyTo"
        | "fieldReplyToHint"
        | "fieldHost"
        | "fieldPort"
        | "fieldSecurity"
        | "fieldUser"
        | "fieldUserHint"
        | "passwordStored"
        | "notConnectedYet"
        | "testToLabel"
        | "testToHint"
        | "makeDefault"
        | "makeDefaultHint"
        | "stepProvider",
        string
    >
>

/** The last wizard step: the heading, an optional note, the agents to tick and the words around the list. */
export interface AgentStepView {
    readonly title: string
    /** A note shown first (the connection stays unfinished); null for none. */
    readonly notice: string | null
    readonly agents: ReadonlyArray<AgentChoice>
    readonly value: ReadonlyArray<string>
    /** The hint above the list, also its accessible label. */
    readonly hint: string
    /** The sentence shown when the workspace has no agent for this connection. */
    readonly none: string
}

/** One Page waiting for the choice (no token). */
export interface MetaPageOption {
    readonly id: string
    readonly name: string
    readonly category: string
    readonly igId: string
    readonly igUsername: string
}

/** What the Meta wizard shows of a connection; tokens are never returned. */
export interface MetaWizardConnection {
    readonly id: string
    readonly name: string
    readonly status: ConnectionStatus
    /** The Meta app keys are set on this NIVO (otherwise the login cannot start). */
    readonly configured: boolean
    readonly pages: ReadonlyArray<MetaPageOption>
    readonly pageId: string
    readonly pageName: string
    readonly igId: string
    readonly igUsername: string
    readonly firstEvent: FirstEvent | null
    readonly agentIds: ReadonlyArray<string>
}

/** Where the Facebook login goes. */
export interface MetaAuthorization {
    readonly connectionId: string
    readonly url: string
}

/** One object of the app-level webhook subscription. */
export interface MetaAppObject {
    readonly callbackUrl: string
    readonly fields: ReadonlyArray<string>
    readonly missing: ReadonlyArray<string>
    readonly urlMatches: boolean
}

/** What Meta really has for a connection. */
export interface MetaCheck {
    readonly ok: boolean
    readonly tokenOk: boolean
    readonly pageId: string
    readonly pageName: string
    readonly igUsername: string
    readonly page: {
        readonly subscribed: boolean
        readonly fields: ReadonlyArray<string>
        readonly missing: ReadonlyArray<string>
    }
    readonly appPage: MetaAppObject | null
    readonly appInstagram: MetaAppObject | null
    readonly appKnown: boolean
    readonly webhookUrl: string
    readonly localOnly: boolean
    readonly verifyTokenSet: boolean
    readonly repaired: boolean
}
