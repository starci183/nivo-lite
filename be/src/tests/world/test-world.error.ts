import { DomainError } from "@modules/platform/errors"
/** Intentional failures used to prove rollback and retry behavior. */
export enum TestWorldErrorCode {
    /** Forces the business transaction to roll back after enqueuing. */
    TransactionRefused = "TEST_WORLD_TRANSACTION_REFUSED",
    /** Makes the first processor attempt fail so redispatch can reclaim it. */
    ProviderDown = "TEST_WORLD_PROVIDER_DOWN",
}
/** The test world's one named error family. */
export class TestWorldError extends DomainError<TestWorldErrorCode> {}
