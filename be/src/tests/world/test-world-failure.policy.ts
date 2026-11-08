import { TestWorldError } from "./test-world.error"
import type { TestWorldErrorCode } from "./test-world.error"

/** A test-world failure typed as a plain `Error`, the reason a rejected promise must carry. */
export const testWorldFailure = (code: TestWorldErrorCode): Error => new TestWorldError({ code })
