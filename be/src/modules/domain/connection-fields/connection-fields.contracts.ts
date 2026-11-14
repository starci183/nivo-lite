import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"

/**
 * THE GENERIC CONNECTION FORM of a provider page ("Connect"), the ONE surface where a connection is configured: every provider DECLARES,
 * as data beside its other declarations, the fields an owner may see and change on one of its accounts, its guidance, and the actions
 * it offers beyond save and check, and registers ONE writer that hands a change or an action to the provider's own existing write (the
 * same service its wizard calls). This capability reads the declarations, shows the current PUBLIC values, checks a change against the
 * declaration (and the provider's own rules) before anything is written, and dispatches it; it never writes a connection or a secret
 * itself, and never reads a secret.
 */

/** Words in the owner's two languages. */
export interface FieldWords {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/**
 * Declared text a page shows: words of the back end (`text`), or the key of the web's message catalogue that holds the words today
 * (`key`, e.g. `sepayConnection.liveConfirmBody`) so no prose is copied between the two; at least one of them is set.
 */
export interface DeclaredText {
    /** The words, when the back end holds them; else null. */
    readonly text: FieldWords | null
    /** The key of the web catalogue holding the words, when only the web holds them; else null. */
    readonly key: string | null
}

/**
 * `text`: free text within its bounds; `secret`: write-only (its value is never answered, only whether one is sealed); `choice`: one
 * of the declared values; `identity`: what identifies the account at the provider, shown and never edited here.
 */
export type ConnectionFieldKind = "text" | "secret" | "choice" | "identity"

/**
 * Where the current public value of a field is read: a public fact of the connection, its environment, the address the provider
 * delivers its webhooks to (the connections capability's own), or nowhere (a secret, an action input).
 */
export type ConnectionFieldSource =
    | { readonly kind: "meta"; readonly key: string }
    | { readonly kind: "environment" }
    | { readonly kind: "webhook-url" }
    | { readonly kind: "none" }

/** How a page knows a secret is sealed: a public fact the provider sets once it sealed it, or the connection's stored credential. */
export type SealedBy = { readonly kind: "meta-flag"; readonly key: string } | { readonly kind: "stored-secret" }

/** One value a `choice` field takes, as declared. */
export interface FieldChoice {
    /** The value sent back. */
    readonly value: string
    /** Its words. */
    readonly label: FieldWords
    /** The question asked before this value is saved, when choosing it is consequential (going live); absent otherwise. */
    readonly confirm?: DeclaredText
}

/** One field of a provider's connection form (or one input of an action), declared as data. */
export interface ConnectionFieldDeclaration {
    /** The key a change names it by. */
    readonly key: string
    /** Its label. */
    readonly label: FieldWords
    /** Its kind. */
    readonly kind: ConnectionFieldKind
    /** True when a `text` or `choice` field may not be left empty. */
    readonly required: boolean
    /** The shortest value a `text` or `secret` takes; absent = no lower bound. */
    readonly minLength?: number
    /** The longest value a `text` or `secret` takes; null for a `choice` or an `identity`. */
    readonly maxLength: number | null
    /** The values of a `choice`; empty otherwise. */
    readonly choices: ReadonlyArray<FieldChoice>
    /** The name of the list the choices come from (`banks`), so a page may draw each option richly; absent for a list of its own. */
    readonly choiceSource?: string
    /** True when the choices are many and the page should let the person search them. */
    readonly searchable?: boolean
    /** True when the page offers to copy the value (an address to paste at the provider). */
    readonly copyable?: boolean
    /** Where its public value is read. */
    readonly source: ConnectionFieldSource
    /** For a `secret`: how a sealed value is known. */
    readonly sealedBy?: SealedBy
    /** What to know or do before filling it. */
    readonly guidance?: DeclaredText
}

/** The roles of a workspace that may change a provider's connection fields (as its existing writes gate them). */
export type FieldEditor = "owner" | "manager"

/** One member of what an action answers. */
export interface ActionResultMember {
    /** The key of the member. */
    readonly key: string
    /** Its label. */
    readonly label: FieldWords
}

/** An action of a connection beyond save and check (send a test email, make it the default), declared as data. */
export interface ConnectionActionDeclaration {
    /** The key a run names it by (`test_send`). */
    readonly key: string
    /** Its label. */
    readonly label: FieldWords
    /** The roles that may run it (as the existing write gates it). */
    readonly runBy: ReadonlyArray<FieldEditor>
    /** What the person gives it. */
    readonly inputs: ReadonlyArray<ConnectionFieldDeclaration>
    /** What it answers. */
    readonly results: ReadonlyArray<ActionResultMember>
    /** What to know before running it. */
    readonly guidance?: DeclaredText
    /** The question asked before it runs, when running it is consequential. */
    readonly confirm?: DeclaredText
}

/** A provider's connection form: its fields, actions and guidance, who may change them, and whether a check means something. */
export interface ProviderFieldsDeclaration {
    /** The provider key. */
    readonly provider: string
    /** The roles that may change the fields and the name. */
    readonly editableBy: ReadonlyArray<FieldEditor>
    /** True when "check connection" asks the provider something for this provider (`checkConnection`). */
    readonly canTest: boolean
    /** The fields, in the order the form draws them. */
    readonly fields: ReadonlyArray<ConnectionFieldDeclaration>
    /** The actions beyond save and check; absent = none. */
    readonly actions?: ReadonlyArray<ConnectionActionDeclaration>
    /** What to know about the whole form. */
    readonly guidance?: DeclaredText
}

/**
 * Why a provider's form may not be registered, because it could put a secret on a page: `secret_source_readable` (a `secret` field
 * declares a source a value is read from), `action_result_secret` (an action declares a result member whose key is a secret field
 * of the form or a secret input of the action). An action result has no source of its own, so none can be declared to come from a
 * stored secret; what a writer answers at run time is filtered to the declared members, never a secret key.
 */
export type DeclarationProblemCode = "secret_source_readable" | "action_result_secret"

/** One problem of a declaration: its code, and the field or action result it is about. */
export interface DeclarationProblem {
    /** The provider of the form. */
    readonly provider: string
    /** The code. */
    readonly code: DeclarationProblemCode
    /** The field key, or `<action>.<result key>`. */
    readonly key: string
}

/** A change of one account, checked against its declaration: the new display name, and only the fields that change. */
export interface ConnectionFieldChange {
    /** The new display name, or null to keep it. */
    readonly displayName: string | null
    /** The new values by key, trimmed; a secret appears only when a new one was given. */
    readonly values: Readonly<Record<string, string>>
}

/** A value the provider's own rules refuse, found before anything is written. */
export interface FieldRefusal {
    /** The field. */
    readonly key: string
    /** Why, as a stable word (`not_an_account_number`). */
    readonly reason: string
}

/** The checked input values of an action, by input key. */
export interface ActionInputValues {
    readonly [key: string]: string
}

/** What an action answers, by result member key; null where the provider does not say. */
export interface ActionAnswer {
    readonly [key: string]: string | null
}

/**
 * What a provider registers: its declarations, the provider's own rules a change must pass BEFORE any write (`check`, the same rule
 * functions its write uses), the write that hands a checked change to its OWN existing write path (which proves the caller's role
 * again, seals a secret and patches the connection as its wizard does), and the run of its declared actions through the same services.
 */
export interface ConnectionFieldWriter {
    /** The forms of the providers this writer serves. */
    readonly declarations: ReadonlyArray<ProviderFieldsDeclaration>
    /** The values of the change the provider's own rules refuse; empty when it may be written; absent = only the declaration rules. */
    check?(connection: ConnectionRecord, change: ConnectionFieldChange): ReadonlyArray<FieldRefusal>
    /** Applies a checked change to the account through the provider's own write. */
    write(actor: ConnectionActor, connection: ConnectionRecord, change: ConnectionFieldChange): Promise<void>
    /** Runs one declared action with its checked inputs through the provider's own service; absent for a provider with no action. */
    run?(actor: ConnectionActor, connection: ConnectionRecord, action: string, inputs: ActionInputValues): Promise<ActionAnswer>
}

/** One value of a `choice` as the form draws it. */
export interface FieldChoiceView {
    /** The value sent back. */
    readonly value: string
    /** Its words. */
    readonly label: FieldWords
    /** The question to ask before saving it, or null. */
    readonly confirm: DeclaredText | null
}

/** One field (or action input) as the form draws it. */
export interface ConnectionFieldView {
    /** Its key. */
    readonly key: string
    /** Its label. */
    readonly label: FieldWords
    /** Its kind. */
    readonly kind: ConnectionFieldKind
    /** True when it may not be left empty. */
    readonly required: boolean
    /** The shortest value it takes, or null. */
    readonly minLength: number | null
    /** The longest value it takes, or null. */
    readonly maxLength: number | null
    /** The values of a `choice`. */
    readonly choices: ReadonlyArray<FieldChoiceView>
    /** The list the choices come from, or null. */
    readonly choiceSource: string | null
    /** True when the page should let the person search the choices. */
    readonly searchable: boolean
    /** True when the page offers to copy the value. */
    readonly copyable: boolean
    /** Its current public value; always null for a secret and an action input. */
    readonly value: string | null
    /** For a secret: whether one is sealed; null for every other kind. */
    readonly sealed: boolean | null
    /** True when the caller may change it here (an action input: may run the action). */
    readonly editable: boolean
    /** What to know or do before filling it, or null. */
    readonly guidance: DeclaredText | null
}

/** One action as the form draws it. */
export interface ConnectionActionView {
    /** Its key. */
    readonly key: string
    /** Its label. */
    readonly label: FieldWords
    /** True when the caller may run it. */
    readonly canRun: boolean
    /** What the person gives it. */
    readonly inputs: ReadonlyArray<ConnectionFieldView>
    /** What it answers. */
    readonly results: ReadonlyArray<ActionResultMember>
    /** What to know before running it, or null. */
    readonly guidance: DeclaredText | null
    /** The question to ask before it runs, or null. */
    readonly confirm: DeclaredText | null
}

/** The connection form of one account. */
export interface ConnectionFieldsView {
    /** The account. */
    readonly connectionId: string
    /** Its provider. */
    readonly provider: string
    /** Its display name. */
    readonly displayName: string
    /** True when the caller may rename it and change its editable fields. */
    readonly canEdit: boolean
    /** True when the provider registered a writer: false means the whole form is read-only. */
    readonly writable: boolean
    /** True when "check connection" means something for this provider. */
    readonly canTest: boolean
    /** The fields. */
    readonly fields: ReadonlyArray<ConnectionFieldView>
    /** The actions beyond save and check. */
    readonly actions: ReadonlyArray<ConnectionActionView>
    /** What to know about the whole form, or null. */
    readonly guidance: DeclaredText | null
}

/** One member of an action's answer as a page draws it. */
export interface ActionResultValue {
    /** The key of the member. */
    readonly key: string
    /** Its label. */
    readonly label: FieldWords
    /** Its value, or null where the provider does not say. */
    readonly value: string | null
}

/** What running an action answers: its result members, and the form again. */
export interface ConnectionActionResult {
    /** The action run. */
    readonly action: string
    /** Its result members, in declared order. */
    readonly results: ReadonlyArray<ActionResultValue>
    /** The form of the account after the action. */
    readonly form: ConnectionFieldsView
}

/** One field a person changes (or one input of an action). */
export interface ConnectionFieldInput {
    /** The field's key. */
    readonly key: string
    /** The new value; an empty secret keeps the sealed one. */
    readonly value: string
}

/** The display name a call may carry: a text, null, or absent. */
export type ConnectionDisplayNameInput = string | null | undefined

/** The inputs of an action call: a list, null, or absent. */
export type ConnectionActionInputs = ReadonlyArray<ConnectionFieldInput> | null | undefined
