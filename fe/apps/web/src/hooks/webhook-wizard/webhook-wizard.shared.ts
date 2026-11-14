/** The steps of the webhook wizard, in order. */
export const WEBHOOK_STEPS = ["address", "secret", "test", "done"] as const

/** The index of the step that shows the signing secret, the only time it is shown. */
export const SECRET_STEP = 1
