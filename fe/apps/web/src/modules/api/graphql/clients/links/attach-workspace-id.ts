import { SetContextLink } from "@apollo/client/link/context"
import { openWorkspaceId } from "@/modules/routes"
import { GraphQLHeadersKey } from "../../types"
import { headersOf } from "./headers-of"

/** Attaches the workspace of the address the browser has open (the route names it) as `X-Workspace-Id`; none on an address outside a workspace. */
export const createAttachWorkspaceIdLink = (): SetContextLink =>
    new SetContextLink((previous) => {
        const workspaceId = openWorkspaceId()
        return {
            headers: {
                ...(workspaceId === undefined ? {} : { [GraphQLHeadersKey.XWorkspaceId]: workspaceId }),
                ...headersOf(previous.headers),
            },
        }
    })
