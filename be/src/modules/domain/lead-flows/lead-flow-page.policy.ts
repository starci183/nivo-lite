import { jsonOf } from "./lead-flow-fields.policy"
import { textOf } from "./lead-flow-identity.policy"
import { recordOf } from "./lead-flow-score.policy"

/** The chosen Page of a sealed Meta credential. */
export interface PageSecret {
    /** The Page id. */
    readonly pageId: string
    /** The Page token. */
    readonly pageToken: string
}

/** The chosen Page of a sealed Meta credential, or null when it holds none (or is not JSON). */
export const pageSecretOf = (plain: string): PageSecret | null => {
    const secret = recordOf(jsonOf(plain).value)
    const pageId = textOf(secret.pageId)
    const pageToken = textOf(secret.pageToken)
    return pageId === "" || pageToken === "" ? null : { pageId, pageToken }
}
