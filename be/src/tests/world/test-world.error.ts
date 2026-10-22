import { DomainError } from "@modules/platform/errors"
/** Intentional failures used to prove rollback and retry behavior. */
export enum TestWorldErrorCode {
    /** Forces the business transaction to roll back after enqueuing. */
    TransactionRefused = "TEST_WORLD_TRANSACTION_REFUSED",
    /** Makes the first processor attempt fail so redispatch can reclaim it. */
    ProviderDown = "TEST_WORLD_PROVIDER_DOWN",
    /** A proof reached the Auth account directory, which its composition never reads. */
    AccountsUnread = "TEST_WORLD_ACCOUNTS_UNREAD",
    /** A row a proof wrote or expects is not in the local database. */
    RowMissing = "TEST_WORLD_ROW_MISSING",
}
/** The test world's one named error family. */
export class TestWorldError extends DomainError<TestWorldErrorCode> {}
