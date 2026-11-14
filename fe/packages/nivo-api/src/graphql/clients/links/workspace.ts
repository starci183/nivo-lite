import { SetContextLink } from "@apollo/client/link/context"
import { GraphQLHeadersKey } from "../../wire"
import { headersOf } from "./headers"

/** Parameters of the workspace link. */
export interface CreateAttachWorkspaceIdLinkParams {
    /** The workspace of the address the browser has open (the route names it), or undefined on an address outside a workspace. */
    workspaceId: () => string | undefined
}

/** Attaches the workspace of the address the browser has open as `X-Workspace-Id`; none on an address outside a workspace. */
export const createAttachWorkspaceIdLink = ({ workspaceId }: CreateAttachWorkspaceIdLinkParams): SetContextLink =>
    new SetContextLink((previous) => {
        const openId = workspaceId()
        return {
            headers: {
                ...(openId === undefined ? {} : { [GraphQLHeadersKey.XWorkspaceId]: openId }),
                ...headersOf(previous.headers),
            },
        }
    })
