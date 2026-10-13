/** One Google account a workspace connected. */
export class GoogleAccountBody {
    /** The id of the connection. */
    id!: string
    /** The account email. */
    email!: string
    /** The status of the connection. */
    status!: string
}

/** The HTTP response of the GoogleAccounts operation. */
export class GoogleAccountsResponse {
    /** The accounts. */
    accounts!: GoogleAccountBody[]
}
