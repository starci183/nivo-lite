/** The demo workspace's name. */
export const SEED_WORKSPACE_NAME = "Spa Hoa Mai"

/** The owner account of the demo workspace; the password is chosen by the command. */
export const SEED_OWNER = { email: "mai@nivo.vn", name: "Ch\u1ecb Mai" } as const

/** The staff account of the demo workspace; the password is chosen by the command. */
export const SEED_STAFF = { email: "ha@nivo.vn", name: "Ch\u1ecb H\u00e0" } as const

/** How the operator must keep the credentials after their single display. */
export const SEED_CREDENTIALS_GUIDANCE =
    "Shown once and not stored. Seal them with `starci app secret set dev test-accounts` (see .starcistacks) before closing this terminal; the next run sets new passwords."
