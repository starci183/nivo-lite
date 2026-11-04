import { createSlice } from "@reduxjs/toolkit"
import type { ActionCreatorWithOptionalPayload, PayloadAction, Reducer } from "@reduxjs/toolkit"

/** The app-wide workspace selection. */
export interface WorkspaceSliceState {
    /** The workspace the person works in; the GraphQL client sends it as `X-Workspace-Id`. */
    activeWorkspaceId: string | undefined
}

const initialState: WorkspaceSliceState = { activeWorkspaceId: undefined }

const workspaceSlice = createSlice({
    name: "workspace",
    initialState,
    reducers: {
        setActiveWorkspaceId: (state, action: PayloadAction<string | undefined>) => {
            state.activeWorkspaceId = action.payload
        },
    },
})

const dest = workspaceSlice.actions
/** Selects (or clears) the active workspace. */
export const setActiveWorkspaceId: ActionCreatorWithOptionalPayload<
    string | undefined,
    "workspace/setActiveWorkspaceId"
> = dest.setActiveWorkspaceId
/** The reducer of the workspace selection. */
export const workspaceReducer: Reducer<WorkspaceSliceState> = workspaceSlice.reducer
