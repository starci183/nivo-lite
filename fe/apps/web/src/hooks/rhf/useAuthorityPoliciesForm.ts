"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { AuthorityProfile } from "@/hooks/authority"

/** The values of the policies form. */
export interface AuthorityPoliciesValues {
    policies: string
    replyStyle: string
    brandVoice: string
}

const schema = z.object({ policies: z.string().trim(), replyStyle: z.string().trim(), brandVoice: z.string().trim() })

/** The policies form over the stored profile: the three texts trimmed; the stored values refill it when they change. */
export const useAuthorityPoliciesForm = (profile: AuthorityProfile) => {
    const values = useMemo<AuthorityPoliciesValues>(
        () => ({ policies: profile.policies, replyStyle: profile.replyStyle, brandVoice: profile.brandVoice }),
        [profile],
    )
    return useForm<AuthorityPoliciesValues>({ resolver: zodResolver(schema), values, mode: "onSubmit" })
}
