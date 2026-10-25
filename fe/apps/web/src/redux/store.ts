import { configureStore } from "@reduxjs/toolkit"
import { viewerReducer } from "./slices/viewer"
import { workspaceReducer } from "./slices/workspace"

/** Builds the app store: app-wide state only (selected ids, server-pushed entities); feature-local UI state is zustand. */
export const makeStore = () => configureStore({ reducer: { viewer: viewerReducer, workspace: workspaceReducer } })

/** The app store. */
export type AppStore = ReturnType<typeof makeStore>
/** The state tree of the app store. */
export type RootState = ReturnType<AppStore["getState"]>
/** The dispatch function of the app store. */
export type AppDispatch = AppStore["dispatch"]
