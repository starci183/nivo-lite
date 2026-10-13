import { SetContextLink } from "@apollo/client/link/context"
import { LocalStorage, StorageId } from "@/modules/storage"
import { GraphQLHeadersKey } from "../../types"

/** Attaches the workspace the person works in (the persisted active workspace) as `X-Workspace-Id`; none when no workspace is selected. */
export const createAttachWorkspaceIdLink = () =>
    new SetContextLink((previous) => {
        const workspaceId = LocalStorage.get<string>(StorageId.ActiveWorkspaceId)
        return {
            headers: {
                ...previous.headers,
                ...(workspaceId === undefined ? {} : { [GraphQLHeadersKey.XWorkspaceId]: workspaceId }),
            },
        }
    })
