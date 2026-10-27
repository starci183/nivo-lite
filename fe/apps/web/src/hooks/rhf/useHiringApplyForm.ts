"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { applyDefaults } from "@/hooks/hiringPublic"
import type { ApplyValues } from "@/modules/types"

const schema = z.object({
    name: z.string().trim().min(1),
    phone: z.string(),
    email: z.string(),
    availability: z.array(z.string()),
    availabilityText: z.string(),
    answers: z.record(z.string(), z.string()),
    consent: z.boolean(),
    website: z.string(),
})

/** The public apply form: name, contact, availability, the job's own answers, the consent and the honeypot. */
export const useHiringApplyForm = () =>
    useForm<ApplyValues>({ resolver: zodResolver(schema), defaultValues: applyDefaults(), mode: "onChange" })
