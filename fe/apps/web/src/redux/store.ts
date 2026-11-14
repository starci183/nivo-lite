import {
    configureStore,
    type UnknownAction,
    type Tuple,
    type ThunkDispatch,
    type StoreEnhancer,
    type EnhancedStore,
} from "@reduxjs/toolkit"
import { viewerReducer, type ViewerSliceState } from "./slices/viewer"

type MakeStoreResult = EnhancedStore<
    {
        viewer: ViewerSliceState
    },
    UnknownAction,
    Tuple<
        [
            StoreEnhancer<{
                dispatch: ThunkDispatch<
                    {
                        viewer: ViewerSliceState
                    },
                    undefined,
                    UnknownAction
                >
            }>,
            StoreEnhancer,
        ]
    >
>

/** Builds the app store: app-wide state only (selected ids, server-pushed entities); feature-local UI state is zustand. */
export const makeStore = (): MakeStoreResult => configureStore({ reducer: { viewer: viewerReducer } })

/** The app store. */
export type AppStore = ReturnType<typeof makeStore>
/** The state tree of the app store. */
export type RootState = ReturnType<AppStore["getState"]>
/** The dispatch function of the app store. */
export type AppDispatch = AppStore["dispatch"]
