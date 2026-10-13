import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction } from "@reduxjs/toolkit"

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

/** Selects (or clears) the active workspace. */
export const { setActiveWorkspaceId } = workspaceSlice.actions
/** The reducer of the workspace selection. */
export const workspaceReducer = workspaceSlice.reducer
