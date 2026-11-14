import { isCrmId, type CrmAuthType, type CrmTemplate, type CrmView } from "@/modules/crm"

/** The steps of the CRM connect wizard: pick the CRM, address and key, what the live Swagger came to. */
export const CRM_STEPS = ["pick", "connect", "result"] as const

/** One step of the wizard. */
export type CrmWizardStep = (typeof CRM_STEPS)[number]

/** What the shop types (and what a template fixes). */
export interface CrmForm {
    readonly crmId: string
    readonly baseUrl: string
    readonly swaggerUrl: string
    readonly authType: CrmAuthType
    readonly authName: string
    readonly secret: string
}

/** The form of a new connection. */
export const EMPTY_FORM: CrmForm = { crmId: "", baseUrl: "", swaggerUrl: "", authType: "bearer", authName: "", secret: "" }

/** The form a saved connection starts the edit with; the key is never read back. */
export const formOfView = (view: CrmView | undefined): CrmForm =>
    view === undefined
        ? EMPTY_FORM
        : {
              crmId: view.crmId,
              baseUrl: view.baseUrl,
              swaggerUrl: view.swaggerUrl,
              authType: view.authType === "header" ? "header" : "bearer",
              authName: view.authName,
              secret: "",
          }

/** Whether the connect step may be sent: a template needs the address and a key, an own CRM also its id, Swagger link and header. */
export const isFormReady = (form: CrmForm, template: CrmTemplate | undefined, hasSecret: boolean): boolean => {
    if (form.baseUrl.trim() === "") return false
    if (form.secret.trim() === "" && !hasSecret) return false
    if (template !== undefined) return true
    if (!isCrmId(form.crmId.trim()) || form.swaggerUrl.trim() === "") return false
    return form.authType === "bearer" || form.authName.trim() !== ""
}
