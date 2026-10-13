import { registerEnumType } from "@nestjs/graphql"
import { PresentedRole } from "@modules/domain/workspace-members"

export { PresentedRole }

/** GraphQL name of the membership role. The value is the domain enum. */
registerEnumType(PresentedRole, { name: "WorkspaceRole" })
