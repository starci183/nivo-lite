/** One identity of a contact as the /contacts page shows it, with how it is proven and the merge reason that brought it. */
export interface ContactIdentityView {
    /** The id of the record. */
    readonly id: string
    /** The kind of the identity: `phone`, `email`, `channel` or `external`. */
    readonly kind: string
    /** The channel of a channel id (`zalo`, `telegram`); empty otherwise. */
    readonly provider: string
    /** The account (connection) of a channel id or an outside id; empty otherwise. */
    readonly account: string
    /** The value as it is stored. */
    readonly value: string
    /** True when proven; a self-declared phone or mail is a proposal (false). */
    readonly verified: boolean
    /** How it was proven (`channel`, `token`, `member`); null when it is only a claim. */
    readonly verifiedBy: string | null
    /** Where it was learned: `channel`, `step`, `member` or `form`. */
    readonly source: string
    /** The merge reason that brought it to this contact, or null. */
    readonly joinedBy: string | null
    /** When it happened, as an ISO timestamp. */
    readonly at: string
}

/** One contact as the list and the detail show it. */
export interface ContactView {
    /** The id of the record. */
    readonly id: string
    /** The name the person is shown by; null when none is known. */
    readonly displayName: string | null
    /** The tags a person put on the contact. */
    readonly tags: ReadonlyArray<string>
    /** When the contact was created, as an ISO timestamp. */
    readonly createdAt: string
    /** When the contact last changed, as an ISO timestamp. */
    readonly updatedAt: string
    /** The identities of the contact. */
    readonly identities: ReadonlyArray<ContactIdentityView>
}

/** A page of contacts, newest first, and the cursor of the next page (null on the last). */
export interface ContactsPageView {
    /** The contacts of this page. */
    readonly contacts: ReadonlyArray<ContactView>
    /** The cursor of the next page; null on the last. */
    readonly next: string | null
}

/** One remembered fact: its name and its value as JSON text. */
export interface ContactMemoryFactView {
    /** The name of the remembered fact. */
    readonly name: string
    /** The value as it is stored. */
    readonly value: string
}

/** One remembered step outcome. */
export interface ContactMemoryNoteView {
    /** The workflow that produced the outcome. */
    readonly workflow: string
    /** The step that produced the outcome. */
    readonly step: string
    /** How the step ended. */
    readonly status: string
    /** When it happened, as an ISO timestamp. */
    readonly at: string
    /** The step output as JSON text. */
    readonly output: string
}

/** What the workflows remember of a contact, masked for a person's screen. */
export interface ContactMemoryPageView {
    /** The remembered facts. */
    readonly facts: ReadonlyArray<ContactMemoryFactView>
    /** The remembered step outcomes. */
    readonly notes: ReadonlyArray<ContactMemoryNoteView>
}

/** "Maybe the same person": a suggestion only, never applied. */
export interface ContactSuggestionView {
    /** The contact this refers to. */
    readonly contactId: string
    /** The name the person is shown by; null when none is known. */
    readonly displayName: string | null
    /** Why the contact is suggested (`same_name`, `claimed_identity`). */
    readonly why: string
    /** The kind of the claimed identity, or null. */
    readonly identityKind: string | null
    /** The value of the claimed identity, or null. */
    readonly identityValue: string | null
}

/** The detail of one contact: who, the memory and the suggestions. */
export interface ContactDetailView {
    /** The contact. */
    readonly contact: ContactView
    /** What the agents remember of the contact. */
    readonly memory: ContactMemoryPageView
    /** The suggestions of possible duplicates; never applied by themselves. */
    readonly suggestions: ReadonlyArray<ContactSuggestionView>
}

/** The outcome of linking an identity: linked (verified), proposed (a claim) or merged into another contact. */
export interface LinkContactIdentityView {
    /** What linking came to: `linked`, `proposed` or `merged`. */
    readonly outcome: string
    /** The contact this refers to. */
    readonly contactId: string
}

/** What the list asks: a search (an exact phone or mail, or a name prefix), else a page after a cursor. */
export interface ReadContactsRequest {
    /** The workspace the request runs in. */
    readonly workspaceId: string
    /** An exact phone or mail, or a name prefix. */
    readonly search?: string | undefined
    /** The cursor after which the page starts. */
    readonly cursor?: string | undefined
    /** The page size. */
    readonly size?: number | undefined
}

/** What the detail asks. */
export interface ReadContactRequest {
    /** The workspace the request runs in. */
    readonly workspaceId: string
    /** The id of the record. */
    readonly id: string
}

/** A change of the display name and / or the tags. */
export interface UpdateContactRequest {
    /** The workspace the request runs in. */
    readonly workspaceId: string
    /** The id of the record. */
    readonly id: string
    /** The name the person is shown by; null when none is known. */
    readonly displayName?: string | null | undefined
    /** The tags a person put on the contact. */
    readonly tags?: ReadonlyArray<string> | undefined
}

/** An identity a person links (verified `member`: the person decided). */
export interface LinkContactIdentityRequest {
    /** The workspace the request runs in. */
    readonly workspaceId: string
    /** The contact this refers to. */
    readonly contactId: string
    /** The kind of identity to link: `phone`, `email` or `external`; any other text reads as `phone`. */
    readonly kind: string
    /** The value as it is stored. */
    readonly value: string
    /** The account (connection) of a channel id or an outside id; empty otherwise. */
    readonly account?: string | undefined
}

/** An identity a person takes away. */
export interface UnlinkContactIdentityRequest {
    /** The workspace the request runs in. */
    readonly workspaceId: string
    /** The contact this refers to. */
    readonly contactId: string
    /** The identity taken away. */
    readonly identityId: string
}

/** A merge a person decides. */
export interface MergeContactsRequest {
    /** The workspace the request runs in. */
    readonly workspaceId: string
    /** The contact that stays. */
    readonly intoContactId: string
    /** The contact merged into it. */
    readonly fromContactId: string
}

/** Facts a person makes the agents forget. */
export interface ForgetContactMemoryRequest {
    /** The workspace the request runs in. */
    readonly workspaceId: string
    /** The contact this refers to. */
    readonly contactId: string
    /** The remembered facts. */
    readonly facts: ReadonlyArray<string>
}

/** An erasure a person decides. */
export interface DeleteContactRequest {
    /** The workspace the request runs in. */
    readonly workspaceId: string
    /** The id of the record. */
    readonly id: string
}
