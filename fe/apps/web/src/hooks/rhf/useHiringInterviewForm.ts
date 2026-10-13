"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { InterviewValues } from "@/hooks/hiringCandidate"

const schema = z.object({
    interviewerUserId: z.string(),
    mode: z.string(),
    location: z.string(),
    durationMin: z.number().int().min(15).max(180),
})

/** The interview request form: who interviews, how, where and for how long. */
export const useHiringInterviewForm = (defaults: InterviewValues) =>
    useForm<InterviewValues>({ resolver: zodResolver(schema), values: defaults, mode: "onChange" })
