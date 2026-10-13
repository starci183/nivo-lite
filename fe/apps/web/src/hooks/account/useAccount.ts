"use client"

import { useQueryMyAccountSwr } from "@/hooks/swr/api/graphql/queries/useQueryMyAccountSwr"

/** The signed-in account (name, e-mail, linked sign-in methods, device sessions) from the back end GraphQL API. */
export const useAccount = () => useQueryMyAccountSwr()
