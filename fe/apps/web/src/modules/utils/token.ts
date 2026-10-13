/** A fresh idempotency token for one form attempt: sending it twice does the work once. */
export const newIdempotencyToken = (): string =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())
