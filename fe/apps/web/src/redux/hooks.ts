import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "./store"

import type { UseDispatch, UseSelector } from "react-redux"
import type { ThunkDispatch, UnknownAction, Dispatch } from "@reduxjs/toolkit"
import type { ViewerSliceState } from "./slices/viewer"

type UseAppDispatchShape = UseDispatch<
    ThunkDispatch<
        {
            viewer: ViewerSliceState
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
}>

/** Typed `useSelector`. */
export const useAppSelector: UseAppSelectorShape = useSelector.withTypes<RootState>()
