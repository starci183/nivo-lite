"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import {
    useMutateDeleteContactSwr,
    useMutateForgetContactMemorySwr,
    useMutateLinkContactIdentitySwr,
    useMutateMergeContactsSwr,
    useMutateUnlinkContactIdentitySwr,
    useMutateUpdateContactSwr,
} from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { linkOutcomeKeyOf, refreshContacts } from "./contacts.shared"

/** What a command that may end in a merge answers: the person the page should open next, or undefined when it failed. */
type PersonId = string | undefined

/** The commands on a person. Each answers whether it worked (a failure was toasted with the back end words) and revalidates the reads. */
export interface ContactCommands {
    readonly update: (
        id: string,
        patch: { readonly displayName: string; readonly tags: ReadonlyArray<string> },
    ) => Promise<boolean>
    readonly link: (id: string, identity: { readonly kind: string; readonly value: string }) => Promise<PersonId>
    readonly unlink: (id: string, identityId: string) => Promise<boolean>
    readonly merge: (fromId: string, intoId: string) => Promise<PersonId>
    readonly forget: (id: string, name: string) => Promise<boolean>
    readonly remove: (id: string) => Promise<boolean>
    readonly isPending: boolean
}

/** The commands on a person (rename, tags, link or unlink an identity, merge, forget a fact, delete) through the back end, toasted. */
export const useContactCommands = (): ContactCommands => {
    const t = useTranslations("contacts")
    const run = useGraphQLWithToast()
    const updating = useMutateUpdateContactSwr()
    const linking = useMutateLinkContactIdentitySwr()
    const unlinking = useMutateUnlinkContactIdentitySwr()
    const merging = useMutateMergeContactsSwr()
    const forgetting = useMutateForgetContactMemorySwr()
    const removing = useMutateDeleteContactSwr()
    const done = useCallback(
        async <T>(job: () => Promise<T>, message: string): Promise<T | undefined> => {
            const answer = await run(job, { successMessage: message })
            if (answer !== undefined) await refreshContacts()
            return answer
        },
        [run],
    )
    return {
        update: async (id, patch) =>
            (await done(
                () => updating.trigger({ id, displayName: patch.displayName, tags: [...patch.tags] }),
                t("updated"),
            )) !== undefined,
        link: async (id, identity) => {
            const answer = await run(() => linking.trigger({ contactId: id, ...identity }), { showSuccessToast: false })
            if (answer === undefined) return undefined
            await refreshContacts()
            toast.success(t(linkOutcomeKeyOf(answer.outcome)))
            return answer.contactId
        },
        unlink: async (id, identityId) =>
            (await done(() => unlinking.trigger({ contactId: id, identityId }), t("unlinked"))) !== undefined,
        merge: async (fromId, intoId) =>
            (await done(() => merging.trigger({ fromContactId: fromId, intoContactId: intoId }), t("merged")))?.id,
        forget: async (id, name) =>
            (await done(() => forgetting.trigger({ contactId: id, facts: [name] }), t("forgotten"))) !== undefined,
        remove: async (id) => (await done(() => removing.trigger({ id }), t("deleted"))) !== undefined,
        isPending:
            updating.isMutating ||
            linking.isMutating ||
            unlinking.isMutating ||
            merging.isMutating ||
            forgetting.isMutating ||
            removing.isMutating,
    }
}
