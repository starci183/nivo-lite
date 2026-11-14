import type { AccountDataTypeDef } from "./account-data.contracts"

/** What the importer hands the account-data capability. */
export interface AccountDataOptions {
    /** Every declared account data type (the apps pass `ACCOUNT_DATA_CATALOG`); a name may be declared once. */
    readonly types: ReadonlyArray<AccountDataTypeDef>
}
