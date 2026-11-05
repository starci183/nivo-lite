import { Button, ChoiceChips, Drawer, IconButton, Link, Stack } from "@starci/grammar/common"
import { landingIconSource } from "@/components/leaves/Icon"
import { NAV_DRAWER_TRIGGER } from "./classNames"

/** One in-page destination of the drawer. */
interface LandingNavDrawerLink {
    readonly id: string
    readonly label: string
    readonly href: string
}

/** The words, links and state of the navigation drawer a phone opens from the bar. */
interface LandingNavDrawerBaseProps {
    readonly props: {
        readonly title: string
        readonly openLabel: string
        readonly closeLabel: string
        readonly isOpen: boolean
        readonly links: ReadonlyArray<LandingNavDrawerLink>
        readonly accountHref: string
        readonly accountLabel: string
        readonly language: {
            readonly label: string
            readonly locale: string
            readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        }
    }
    readonly on: {
        readonly setOpen: (isOpen: boolean) => void
        readonly chooseLocale: (locale: string) => void
    }
}

/** The drawer of the bar below the wide breakpoint: the in-page links, the language and the sign-in. */
export const LandingNavDrawerBase = (props: LandingNavDrawerBaseProps) => (
    <div className={NAV_DRAWER_TRIGGER}>
        <Drawer
            title={props.props.title}
            closeLabel={props.props.closeLabel}
            placement="right"
            isOpen={props.props.isOpen}
            onOpenChange={props.on.setOpen}
            trigger={<IconButton intent="neutral" source={landingIconSource("menu")} label={props.props.openLabel} />}
        >
            <Stack gap="section">
                <Stack gap="row">
                    {props.props.links.map((link) => (
                        <Link key={link.id} href={link.href} onFollow={() => props.on.setOpen(false)}>
                            {link.label}
                        </Link>
                    ))}
                </Stack>
                <ChoiceChips
                    label={props.props.language.label}
                    options={props.props.language.options.map((option) => ({
                        value: option.value,
                        label: option.label,
                    }))}
                    value={props.props.language.locale}
                    onValueChange={props.on.chooseLocale}
                    empty={null}
                />
                <Button intent="neutral" href={props.props.accountHref}>
                    {props.props.accountLabel}
                </Button>
            </Stack>
        </Drawer>
    </div>
)
