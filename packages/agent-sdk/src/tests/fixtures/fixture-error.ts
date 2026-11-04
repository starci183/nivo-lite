import { SdkError } from "../../sdk-error"

/** Thrown when a fixture of the testing export cannot build what a spec asked for, so the spec fails on its own set-up. */
export class FixtureError extends SdkError<"FIXTURE_REFUSED"> {}
