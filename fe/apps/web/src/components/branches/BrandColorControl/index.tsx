import { ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, parseColor, type Color } from "@heroui/react"
import { Stack, Text } from "@starci/grammar/common"
import { useState } from "react"
import { COLOR_POPOVER_BODY_CLASS_NAME, COLOR_ROW_CLASS_NAME, COLOR_TRACK_CLASS_NAME } from "./classNames"

/** The words, value and command of the accent control. */
interface BrandColorControlProps {
    readonly label: string
    readonly hint: string
    readonly hueLabel: string
    readonly swatchLabel: string
    readonly areaLabel: string
    readonly hexLabel: string
    /** The accent as `#rrggbb`. */
    readonly hex: string
    readonly isDisabled: boolean
    /** The accent the person chose, as `#rrggbb`. */
    readonly onChange: (hex: string) => void
}

/**
 * The accent control of the HeroUI theme builder: one hue track (rainbow) with a swatch at its end that opens the colour picker (area for
 * saturation and brightness, the hue track again and the hex field). The picker holds the live colour; a colour set from outside (a reset)
 * replaces it.
 */
export const BrandColorControl = (props: BrandColorControlProps) => {
    const [seen, setSeen] = useState(props.hex)
    const [color, setColor] = useState<Color>(() => parseColor(props.hex))
    if (props.hex !== seen) {
        setSeen(props.hex)
        setColor(parseColor(props.hex))
    }
    const change = (next: Color | null): void => {
        if (next === null) return
        setColor(next)
        props.onChange(next.toString("hex"))
    }
    return (
        <Stack gap="identity">
            <Text>{props.label}</Text>
            <ColorPicker value={color} onChange={change}>
                <div className={COLOR_ROW_CLASS_NAME}>
                    <div className={COLOR_TRACK_CLASS_NAME}>
                        <ColorSlider aria-label={props.hueLabel} channel="hue" colorSpace="hsb" isDisabled={props.isDisabled}>
                            <ColorSlider.Track>
                                <ColorSlider.Thumb />
                            </ColorSlider.Track>
                        </ColorSlider>
                    </div>
                    <ColorPicker.Trigger aria-label={props.swatchLabel} isDisabled={props.isDisabled}>
                        <ColorSwatch size="lg" />
                    </ColorPicker.Trigger>
                </div>
                <ColorPicker.Popover>
                    <div className={COLOR_POPOVER_BODY_CLASS_NAME}>
                        <ColorArea
                            aria-label={props.areaLabel}
                            colorSpace="hsb"
                            xChannel="saturation"
                            yChannel="brightness"
                        >
                            <ColorArea.Thumb />
                        </ColorArea>
                        <ColorSlider aria-label={props.hueLabel} channel="hue" colorSpace="hsb">
                            <ColorSlider.Track>
                                <ColorSlider.Thumb />
                            </ColorSlider.Track>
                        </ColorSlider>
                        <ColorField aria-label={props.hexLabel}>
                            <ColorField.Group>
                                <ColorField.Prefix>
                                    <ColorSwatch size="xs" />
                                </ColorField.Prefix>
                                <ColorField.Input />
                            </ColorField.Group>
                        </ColorField>
                    </div>
                </ColorPicker.Popover>
            </ColorPicker>
            <Text size="xs" tone="muted">
                {props.hint}
            </Text>
        </Stack>
    )
}
