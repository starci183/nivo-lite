import type { CrmConnectionQuery, CrmTemplatesQuery, SaveCrmConnectionMutation } from "@/modules/api"

/** A CRM a package declares, as the connect wizard lists it. */
export type CrmTemplate = CrmTemplatesQuery["crmTemplates"][number]

/** What saving a CRM connection came to. */
export type CrmSaved = SaveCrmConnectionMutation["saveCrmConnection"]

/** A saved CRM connection as the provider page reopens it (never the key). */
export type CrmView = CrmConnectionQuery["crmConnection"]

/** The snapshot of the live Swagger document a connection serves. */
type CrmPin = CrmSaved["pin"]

/** How a CRM key is sent. */
export type CrmAuthType = "bearer" | "header"

/** The id of the "other CRM" row of the pick list. */
export const CRM_OTHER = "other"

/** A CRM id by its form: a lower-case letter, then 1 to 30 lower-case letters, digits or dashes (the back end's law). */
const CRM_ID = /^[a-z][a-z0-9-]{1,30}$/u

/** Whether a text is a CRM id by its form. */
export const isCrmId = (value: string): boolean => CRM_ID.test(value)

/** The capability code under which the back end carries a refusal reason (`detail_<reason>` in `connectorCrm`) as the message. */
export const CRM_REFUSAL_CODE = "DATA_HUB_INVALID"

/** How many operations the packages need, how many are ready and which are not. */
interface CrmReadiness {
    readonly needed: number
    readonly ready: number
    readonly missing: CrmPin["needed"]
}

/** The compatibility of a pin: every operation the installed packages call, and whether the snapshot serves it. */
export const crmReadinessOf = (pin: CrmPin | null): CrmReadiness => {
    const needed = pin?.needed ?? []
    const missing = needed.filter((operation) => operation.state !== "ready")
    return { needed: needed.length, ready: needed.length - missing.length, missing }
}

/** The first 12 characters of the snapshot's sha256. */
export const shortShaOf = (sha: string): string => sha.slice(0, 12)

/** The chip tone of an operation state: ready is success, any other is a warning (red is the one main command's). */
export const crmStateToneOf = (state: string): "success" | "warning" => (state === "ready" ? "success" : "warning")

/** A view drawn while the connection is read: the same shape, no words. */
export const CRM_VIEW_PLACEHOLDER: CrmView = {
    crmId: "-",
    baseUrl: "-",
    swaggerUrl: "-",
    authType: "",
    authName: "",
    hasSecret: false,
    pin: {
        connector: "crm.-",
        swaggerUrl: "-",
        documentSha256: "-",
        pinnedAt: "1970-01-01T00:00:00.000Z",
        live: false,
        needed: ["a", "b", "c"].map((id) => ({ op: id, state: "ready", method: "GET", path: "/", effect: null })),
        others: ["d", "e"].map((id) => ({ op: id, method: "GET", path: "/" })),
    },
}
