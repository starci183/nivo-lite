import type { DataSlot } from "./slot"

/** One tab of the provider page template a connected account opens on. */
export type ProviderPageTab = "config" | "rights" | "api" | "mcp" | "trigger"

/** The tabs of the provider page template as the band's link tabs, and the one the address opens. */
export interface ProviderPageTabsView {
    readonly label: string
    readonly selectedKey: ProviderPageTab
    readonly items: ReadonlyArray<{ readonly id: ProviderPageTab; readonly label: string; readonly href: string }>
}

/** One documented member (a parameter, a returned field, an event field): its name, its type as declared and what it means. */
export interface ProviderDocMemberView {
    readonly id: string
    readonly name: string
    /** The declared type, its format or its closed choices (`in | out`); empty when the registry declares none. */
    readonly type: string
    /** The closed choices the registry declares, verbatim (identifiers the API sends): drawn as code; empty when the member is open. */
    readonly choices: ReadonlyArray<string>
    /** The registry's words for it in the reader's language, else its single-language description; empty when neither exists. */
    readonly meaning: string
}

/** A run of members under one heading row of an entry's table (Tham so, Tra ve moi dong, Du lieu su kien). */
export interface ProviderDocGroupView {
    readonly id: string
    readonly label: string
    readonly rows: ReadonlyArray<ProviderDocMemberView>
}

/** One documented entry of a level: a read (level 1), a tool (level 2) or a trigger (level 3). */
export interface ProviderDocEntryView {
    readonly id: string
    /** The registry id, drawn as code: `nivo.api.sepay.info`, `nivo.tool.bank.transaction.list`, `transaction.received`. */
    readonly name: string
    /** The kind chip: Doc, Ghi, Webhook, Poll (the raw kind when the vocabulary has no word for it). */
    readonly kindLabel: string
    /** The registry's one-line summary in the reader's language; null when none is declared (the id stands alone). */
    readonly summary: string | null
    /** One short fact at the end of the head: the freshness of a read; null when there is none. */
    readonly fact: string | null
    /** The member groups that have members, in order; empty when the entry declares none. */
    readonly groups: ReadonlyArray<ProviderDocGroupView>
    /** Chips after the kind chip that say what the entry does in words (a tool's effect, "ask first"); empty when it has none. */
    readonly marks: ReadonlyArray<string>
    /** A Swagger tool's method and path, drawn as code; null when it has none. */
    readonly line: string | null
    /** Why the entry cannot be used now (a Swagger tool whose state is not ready); null when it can. The entry is then muted. */
    readonly stateNote: string | null
    /** One line under the table (a trigger's batching and recovery); null when there is none. */
    readonly note: string | null
}

/** The shared words of the three docs tabs. */
export interface ProviderDocWords {
    readonly columnName: string
    readonly columnType: string
    readonly columnMeaning: string
    readonly membersEmpty: string
}

/** One level of the docs (API, MCP or Trigger): its lead line, its entries and the line an empty level shows. */
export interface ProviderDocLevelView {
    readonly lead: string
    readonly empty: string
    readonly entries: DataSlot<ReadonlyArray<ProviderDocEntryView>>
}

/** Who decides the events of one trigger: the core agent (locked) or a chosen attached agent (or none). */
export type ProviderTriggerDeciderView =
    | { readonly kind: "locked"; readonly agentName: string }
    | {
          readonly kind: "choice"
          readonly agentId: string | null
          readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
      }

/** One trigger's row on the Trigger tab: its switch, the registry's words, its last fire and its decider. */
export interface ProviderTriggerRowView {
    readonly id: string
    /** The registry's summary in the reader's language; the trigger id when the registry declares none. */
    readonly title: string
    readonly isOn: boolean
    /** Whether turning it on may catch up the events missed while it was off. */
    readonly canCatchUp: boolean
    /** "Last fired 12/11 03:30 · 4 times", or "Has not fired yet". */
    readonly fired: string | null
    /** The decider row; null where the trigger has no decider. */
    readonly decider: ProviderTriggerDeciderView | null
    /** "Webhook" or "Poll": how the provider reports the event. */
    readonly kindLabel: string
    /** The workflows registered on this trigger (the agent and its role beside each); empty when none is. */
    readonly workflows: ReadonlyArray<ProviderTriggerWorkflowView>
}

/** One workflow a trigger wakes, as the Trigger tab lists it. */
export interface ProviderTriggerWorkflowView {
    readonly id: string
    /** The workflow's name; the agent chip when the server names no workflow. */
    readonly name: string
    /** "agent · role", muted beside the name. */
    readonly chip: string
    /** The address of the workflow's map; null when the agent has no page. */
    readonly href: string | null
}

/** The Trigger card of the Trigger tab: one row per trigger and the "when turned on again" choice. */
export interface ProviderTriggerCardView {
    readonly rows: ReadonlyArray<ProviderTriggerRowView>
    /** Whether any trigger can catch up, so the "Khi bat lai" row shows. */
    readonly hasCatchUp: boolean
    /** The choice: catch up the missed events (true) or start from now (false). */
    readonly catchUp: boolean
}

/** One option of a choice field: its label and, when picking it needs a question first, the words of that question. */
export interface ConnectionFormChoiceView {
    readonly id: string
    readonly label: string
    readonly confirm: string | null
}

/** One field of the "Ket noi" card: its words, the value shown (the draft, or what the API read), its limits and its own error. */
export interface ConnectionFormFieldView {
    readonly key: string
    readonly kind: "text" | "secret" | "choice" | "identity"
    /** The API's bilingual label in the reader's language. */
    readonly label: string
    /** The text shown: the draft, else what the API read; a secret is always the draft (empty until typed). */
    readonly value: string
    readonly isRequired: boolean
    /** The API's limits; null when it declares none. */
    readonly minLength: number | null
    readonly maxLength: number | null
    /** The account cannot edit this field (identity, not editable, not writable, or the viewer may not edit). */
    readonly isReadOnly: boolean
    /** A secret is sealed: the field says it is kept and not shown again. */
    readonly isSealed: boolean
    /** A choice with many options is a picker the member can search. */
    readonly isSearchable: boolean
    /** The value has a copy control (a webhook address). */
    readonly isCopyable: boolean
    /** The name of the list a choice's options come from (`banks`); null for an ordinary choice. */
    readonly choiceSource: string | null
    /** The words under the field; null when there are none. */
    readonly guidance: string | null
    readonly choices: ReadonlyArray<ConnectionFormChoiceView>
    readonly error: string | null
}

/** One line a finished action answered (label and value). */
export interface ConnectionFormResultView {
    readonly key: string
    readonly label: string
    readonly value: string
}

/** One command of the account's form (a test send, making a sender the default): its inputs and the results of its last run. */
export interface ConnectionFormActionView {
    readonly key: string
    readonly label: string
    /** The viewer may run it now. */
    readonly canRun: boolean
    readonly guidance: string | null
    /** The question asked before it runs; null when it runs at once. */
    readonly confirm: string | null
    readonly inputs: ReadonlyArray<ConnectionFormFieldView>
    readonly results: ReadonlyArray<ConnectionFormResultView>
}

/** The "Ket noi" card of the Cau hinh tab: the display name and the fields the provider declares, in the API's order. */
export interface ConnectionFormView {
    readonly name: { readonly value: string; readonly isReadOnly: boolean; readonly error: string | null }
    /** The words under the card's title; null when there are none. */
    readonly guidance: string | null
    readonly fields: ReadonlyArray<ConnectionFormFieldView>
    readonly actions: ReadonlyArray<ConnectionFormActionView>
    /** One muted line under the card: a general refusal, the partial-save notice or the check's verdict; null when none. */
    readonly notice: string | null
}
