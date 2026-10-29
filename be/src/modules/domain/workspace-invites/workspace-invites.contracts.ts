/** How an invitation reached the person: a new account invite email, a sign-in link, or not at all (copy the link). */
export type InviteDelivery = "invited" | "existing" | "none"

/** Where invitations are delivered; the composition root binds it to the identity provider. */
export interface InviteDeliveryPort {
    /** Emails the invitation and answers how it reached the person; never throws. */
    deliverInvite(email: string, redirectTo: string): Promise<InviteDelivery>
}

/** What an owner or manager asks to invite. */
export interface InviteRequest {
    /** The address to invite. */
    readonly email: string
    /** The role it grants. */
    readonly role: "manager" | "staff"
    /** The staff row the account will be; absent or null when it is not a staff account. */
    readonly staffId?: string | null | undefined
}

/** A pending invitation as the team page lists it. */
export interface PendingInvite {
    /** The invitation id. */
    readonly id: string
    /** The invited address. */
    readonly email: string
    /** The role it grants. */
    readonly role: "manager" | "staff"
    /** The staff row it links, when any. */
    readonly staffId: string | null
    /** When it was issued, ISO 8601. */
    readonly createdAt: string
    /** When the link stops working, ISO 8601. */
    readonly expiresAt: string
}

/** What an invitation operation answers. */
export interface InviteResult {
    /** The invited address. */
    readonly email: string
    /** The link to accept; the raw token appears only here. */
    readonly link: string
    /** How the invitation reached the person. */
    readonly delivery: InviteDelivery
}

/** What a person is shown before accepting an invitation. */
export interface InvitePreview {
    /** The workspace they are invited to. */
    readonly workspaceName: string
    /** The invited address. */
    readonly email: string
    /** The role it grants. */
    readonly role: string
    /** The staff member it links, when any. */
    readonly staffName: string | null
    /** `pending`, `revoked`, `accepted` or `expired`. */
    readonly state: string
}

/** The workspace a person joined by accepting an invitation. */
export interface AcceptedInvite {
    /** The workspace the person joined. */
    readonly workspaceId: string
}

/** The person who accepts an invitation: the verified claims of their session. */
export interface InviteAcceptor {
    /** The Auth user. */
    readonly id: string
    /** The email of the session; an invitation names the address it is for. */
    readonly email?: string | undefined
}

/** An invitation row as the acceptance policy judges it. */
export interface InviteState {
    /** The invitation id. */
    readonly id: string
    /** The workspace it belongs to. */
    readonly workspaceId: string
    /** The invited address. */
    readonly email: string
    /** The role it grants. */
    readonly role: string
    /** The staff row it links. */
    readonly staffId: string | null
    /** Set once accepted. */
    readonly acceptedAt: string | null
    /** Set once revoked. */
    readonly revokedAt: string | null
    /** When the link stops working, ISO 8601. */
    readonly expiresAt: string
}

/** The invitation fields a rotation or a revocation answers. */
export interface ChangedInvite {
    /** The invitation id. */
    readonly id: string
    /** The invited address. */
    readonly email: string
    /** The role it grants. */
    readonly role: string
}

/** A freshly minted invitation token. */
export interface MintedToken {
    /** The raw token, shown once inside the invitation link. */
    readonly token: string
}
