function isHex(color) {
    if (typeof color !== 'string') return false
    color = color.toLowerCase()

    return /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/.test(color)
}

function isRgba(color) {
    if (typeof color !== 'string') return false
    color = color.toLowerCase()

    return /^(rgba|RGBA)/.test(color)
}

function getRgbValueFromHex(color) {
    color = color.replace('#', '')

    if (color.length === 3)
        color = Array.from(color)
            .map((hexNum) => hexNum + hexNum)
            .join('')

    const colorValues = color.split('')

    return new Array(3)
        .fill(0)
        .map((_, i) =>
            parseInt(`0x${colorValues[i * 2]}${colorValues[i * 2 + 1]}`),
        )
}

function getRgbValueFromRgb(color) {
    return color
        .replace(/rgb\(|rgba\(|\)/g, '')
        .split(',')
        .slice(0, 3)
        .map((n) => parseInt(n))
}

function getOpacity(color) {
    if (!isRgba(color)) return 1
    return Number(
        color
            .toLowerCase()
            .split(',')
            .slice(-1)[0]
            .replace(/[)|\s]/g, ''),
    )
}

function getRgbValue(color) {
    // console.log('color', color)
    const lowerColor = color.toLowerCase()

    return isHex(lowerColor)
        ? getRgbValueFromHex(lowerColor)
        : getRgbValueFromRgb(lowerColor)
}

export function getRgbaValue(color) {
    const rgbValue = getRgbValue(color)

    return rgbValue && [...rgbValue, getOpacity(color)]
}

function getColorFromRgbValue(value) {
    if (!Array.isArray(value))
        throw new Error(`getColorFromRgbValue: ${value} is not an array`)

    const { length } = value
    if (length !== 3 && length !== 4)
        throw new Error(`getColorFromRgbValue: value length should be 3 or 4`)

    return (length === 3 ? 'rgb(' : 'rgba(') + value.join(',') + ')'
}

function fade(color, percent) {
    const rgbValue = getRgbValue(color)

    return getColorFromRgbValue([...rgbValue, percent / 100])
}

function lighten(color, percent) {
    let rgbaValue = getRgbaValue(color)
    rgbaValue = rgbaValue
        .map((v, i) => (i === 3 ? v : v + Math.ceil(2.55 * percent)))
        .map((v) => (v > 255 ? 255 : v))
    // console.log(getColorFromRgbValue(rgbaValue))

    return getColorFromRgbValue(rgbaValue)
}

export { fade, lighten }
