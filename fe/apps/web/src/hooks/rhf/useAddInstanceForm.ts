"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { cleanInstanceName, instanceNameKey } from "@/modules/installations"

/** The values of the add instance form. */
export interface AddInstanceValues {
    name: string
}

/** The add instance form: the name is 1-80 characters and not used by another instance of the type (the server checks again). */
export const useAddInstanceForm = (defaultName: string, taken: ReadonlyArray<string>) => {
    const t = useTranslations("modulesCore")
    const schema = useMemo(
        () =>
            z.object({
                name: z
                    .string()
                    .refine((value) => cleanInstanceName(value) !== null, t("instanceNameInvalid"))
                    .refine(
                        (value) => !taken.some((used) => instanceNameKey(used) === instanceNameKey(value)),
                        t("instanceNameTaken"),
                    ),
            }),
        [t, taken],
    )
    return useForm<AddInstanceValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: defaultName },
        mode: "onChange",
    })
}
