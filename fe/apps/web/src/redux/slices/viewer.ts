import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction } from "@reduxjs/toolkit"

/** The app-wide viewer identity. */
export interface ViewerSliceState {
    /** The person the browser session belongs to: `undefined` before the first answer, `null` when signed out. */
    viewerId: string | null | undefined
}

const initialState: ViewerSliceState = { viewerId: undefined }

const viewerSlice = createSlice({
    name: "viewer",
    initialState,
    reducers: {
        setViewerId: (state, action: PayloadAction<string | null>) => {
            state.viewerId = action.payload
        },
    },
})

/** Records the person the session now belongs to (or `null` on sign-out). */
export const { setViewerId } = viewerSlice.actions
/** The reducer of the viewer identity. */
export const viewerReducer = viewerSlice.reducer
