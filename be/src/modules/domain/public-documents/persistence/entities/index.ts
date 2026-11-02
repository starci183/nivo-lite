import { PublicDocumentEntity } from "./public-document.entity"
import { PublicDocumentSourceEntity } from "./public-document-source.entity"
import { PublicDocumentApprovalEntity } from "./public-document-approval.entity"

export { PublicDocumentEntity, PublicDocumentSourceEntity, PublicDocumentApprovalEntity }

/** Every entity the public-documents capability owns, collected by the database connection. */
export const publicDocumentsEntities = [
    PublicDocumentEntity,
    PublicDocumentSourceEntity,
    PublicDocumentApprovalEntity,
] as const
