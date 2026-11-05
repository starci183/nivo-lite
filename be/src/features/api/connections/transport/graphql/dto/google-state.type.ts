import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where the ledger kept in a Google spreadsheet stands. */
export class GoogleLedgerType {
    /** `none` without the spreadsheets access, `granted` without a sheet, `ready` when it works, `lost` when the access was withdrawn. */
    @Field(() => String)
    state!: "none" | "granted" | "ready" | "lost"

    /** The Google account that gave the access, blank when none. */
    @Field(() => String)
    email!: string

    /** The id of the ledger spreadsheet, blank until named. */
    @Field(() => String)
    sheetId!: string

    /** The address of the ledger spreadsheet, blank until named. */
    @Field(() => String)
    sheetUrl!: string

    /** The title of the ledger spreadsheet as Google named it, blank until known. */
    @Field(() => String)
    sheetTitle!: string

    /** When the last row was written to the ledger spreadsheet (ISO 8601), blank until the first row. */
    @Field(() => String)
    lastRowAt!: string
}

@ObjectType()
/** Whether Google can be used on this deployment, whether a connection waits for consent, and where the ledger stands. */
export class GoogleStateType {
    /** True when Google is set up. */
    @Field(() => Boolean)
    configured!: boolean

    /** True when a Google connection set up for the workspace still waits for the owner to consent once. */
    @Field(() => Boolean)
    consentNeeded!: boolean

    /** Where the ledger kept in a Google spreadsheet stands. */
    @Field(() => GoogleLedgerType)
    ledger!: GoogleLedgerType
}
