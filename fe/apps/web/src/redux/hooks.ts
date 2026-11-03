import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "./store"

import type { UseDispatch, UseSelector } from "react-redux"
import type { ThunkDispatch, UnknownAction, Dispatch } from "@reduxjs/toolkit"
import type { ViewerSliceState } from "./slices/viewer"
import type { WorkspaceSliceState } from "./slices/workspace"

type UseAppDispatchShape = UseDispatch<
    ThunkDispatch<
        {
            viewer: ViewerSliceState
            workspace: WorkspaceSliceState
        },
        undefined,
        UnknownAction
    > &
        Dispatch<UnknownAction>
>

/** Typed `useDispatch`. */
export const useAppDispatch: UseAppDispatchShape = useDispatch.withTypes<AppDispatch>()
type UseAppSelectorShape = UseSelector<{
    viewer: ViewerSliceState
    workspace: WorkspaceSliceState
}>

/** Typed `useSelector`. */
export const useAppSelector: UseAppSelectorShape = useSelector.withTypes<RootState>()
