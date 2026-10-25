import type {
    KnowledgeRequestBody,
    LeadRequestBody,
    LegacyLeadRequestBody,
    MessageRequestBody,
} from "./public-api.contracts"

/** A current or historical public API delivery, retaining its original domain identity. */
export type PublicApiJob =
    | {
          /** The delivery refers to an admitted ledger row. */
          readonly format: "ledger"
          /** The workspace owning the request. */
          readonly workspaceId: string
          /** The original ledger identity. */
          readonly requestId: string
      }
    | {
          /** The historical delivery already has an inbound event. */
          readonly format: "lead"
          /** The workspace owning the inbound event. */
          readonly workspaceId: string
          /** The original inbound identity used for replay dedupe. */
          readonly identity: string
          /** The remaining admitted customer facts. */
          readonly body: LegacyLeadRequestBody
      }
    | {
          /** The historical delivery contains an admitted message. */
          readonly format: "message"
          /** The workspace owning the customer conversation. */
          readonly workspaceId: string
          /** The original message dedupe identity. */
          readonly identity: string
          /** The original work identity, retained for replay safety. */
          readonly dedupeKey: string
          /** The exact draft and approval requirement. */
          readonly body: MessageRequestBody
      }
    | {
          /** The historical delivery already has a knowledge source. */
          readonly format: "knowledge"
          /** The workspace owning the source. */
          readonly workspaceId: string
          /** The original source identity used for replay dedupe. */
          readonly identity: string
          /** The existing source to index. */
          readonly sourceId: string
      }

/** The validated discriminated ledger body sent to its owning fulfillment service. */
export type PublicApiBody =
    | {
          /** Customer handoff. */
          readonly kind: "lead"
          /** The admitted customer facts. */
          readonly body: LeadRequestBody
      }
    | {
          /** Customer message. */
          readonly kind: "message"
          /** The admitted draft and approval requirement. */
          readonly body: MessageRequestBody
      }
    | {
          /** Text knowledge source. */
          readonly kind: "knowledge"
          /** The admitted source content and visibility. */
          readonly body: KnowledgeRequestBody
      }
