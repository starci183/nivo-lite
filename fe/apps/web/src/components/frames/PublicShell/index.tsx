import type { ReactNode } from "react"
import { Page, Stack, Text, TopBar, WorkspaceShell } from "@starci/grammar/common"
import { LanguageMenu } from "@/components/composites/LanguageMenu"
import { PublicBrand } from "@/components/composites/PublicBrand"
import { FOOT_CLASS_NAME } from "./classNames"

/** The business in the bar: its name, or nothing yet (loading) or ever (no such business). */
interface PublicShellBrand {
    readonly name: string | null
    readonly isLoading: boolean
    readonly fallbackLabel: string
}

/** The language menu of the bar, resolved. */
interface PublicShellLanguage {
    readonly label: string
    readonly locale: string
    readonly isPending: boolean
    readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
}

/** The words and slots of a page a visitor opens without signing in. */
interface PublicShellProps {
    /** The name of the page's main region. */
    readonly label: string
    readonly brand: PublicShellBrand
    readonly language: PublicShellLanguage
    readonly onChooseLanguage: (locale: string) => void
    /** The foot line under the page. */
    readonly foot: string
    /** The page measure: `reading` for one narrow card, `product` for a page with two columns. */
    readonly measure: "reading" | "product"
    readonly children: ReactNode
}

/** The frame of every public page: a bar with the business and the language menu, the page on the canvas, the foot line under it. */
export const PublicShell = (props: PublicShellProps) => (
    <WorkspaceShell
        viewport="flow"
        align="stretch"
        header={
            <TopBar
                brand={
                    <PublicBrand
                        name={props.brand.name}
                        isLoading={props.brand.isLoading}
                        fallbackLabel={props.brand.fallbackLabel}
                    />
                }
                actions={
                    <LanguageMenu
                        label={props.language.label}
                        value={props.language.locale}
                        options={props.language.options}
                        isDisabled={props.language.isPending}
                        onChange={props.onChooseLanguage}
                    />
                }
            />
        }
        primaryLabel={props.label}
        primary={
            <Page measure={props.measure}>
                <Stack gap="region">
                    {props.children}
                    <div className={FOOT_CLASS_NAME}>
                        <Text size="xs" tone="muted">
                            {props.foot}
                        </Text>
                    </div>
                </Stack>
            </Page>
        }
    />
)
