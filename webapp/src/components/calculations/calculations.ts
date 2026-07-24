// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IntlShape} from 'react-intl'

import {humanizeDuration} from '../../dateHelpers'

import {Card} from '../../blocks/card'
import {IPropertyTemplate} from '../../blocks/board'
import {Utils} from '../../utils'
import {Constants} from '../../constants'
import {DateProperty} from '../../properties/date/date'
import {evaluateFormula} from '../../properties/formula/lib/evaluator'

const ROUNDED_DECIMAL_PLACES = 2

function getCardProperty(card: Card, property: IPropertyTemplate, templates: readonly IPropertyTemplate[]): string | string[] | number {
    if (property.id === Constants.titleColumnId) {
        return card.title
    }

    switch (property.type) {
    case ('createdBy'): {
        return card.createdBy
    }
    case ('createdTime'): {
        return fixTimestampToMinutesAccuracy(card.createAt)
    }
    case ('updatedBy'): {
        return card.modifiedBy
    }
    case ('updatedTime'): {
        return fixTimestampToMinutesAccuracy(card.updateAt)
    }
    case ('formula'): {
        const value = evaluateFormula(property.formula || '', card, templates)
        if (typeof value === 'number') {
            return value
        }
        return value === undefined ? '' : String(value)
    }
    default: {
        return card.fields.properties[property.id]
    }
    }
}

function fixTimestampToMinutesAccuracy(timestamp: number) {
    // For timestamps that are formatted as hour/minute strings on the UI, we throw away the (milli)seconds
    // so that things like counting unique values work intuitively
    return timestamp - (timestamp % 60000)
}

function cardsWithValue(cards: readonly Card[], property: IPropertyTemplate, templates: readonly IPropertyTemplate[]): Card[] {
    return cards.
        filter((card) => Boolean(getCardProperty(card, property, templates)))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function count(cards: readonly Card[], property: IPropertyTemplate): string {
    return String(cards.length)
}

function countEmpty(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    return String(cards.length - cardsWithValue(cards, property, templates).length)
}

// return count of card which have this property value as not null \\ undefined \\ ''
function countNotEmpty(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    return String(cardsWithValue(cards, property, templates).length)
}

function percentEmpty(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    if (cards.length === 0) {
        return ''
    }
    return String((((cards.length - cardsWithValue(cards, property, templates).length) / cards.length) * 100).toFixed(0)) + '%'
}

function percentNotEmpty(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    if (cards.length === 0) {
        return ''
    }
    return String(((cardsWithValue(cards, property, templates).length / cards.length) * 100).toFixed(0)) + '%'
}

function countValueHelper(cards: readonly Card[], property: IPropertyTemplate, templates: readonly IPropertyTemplate[]): number {
    let values = 0

    if (property.type === 'multiSelect') {
        cardsWithValue(cards, property, templates).
            forEach((card) => {
                values += (getCardProperty(card, property, templates) as string[]).length
            })
    } else {
        values = cardsWithValue(cards, property, templates).length
    }

    return values
}

function countValue(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    return String(countValueHelper(cards, property, templates))
}

function countChecked(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    return countValue(cards, property, intl, templates)
}

function countUnchecked(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    return String(cards.length - countValueHelper(cards, property, templates))
}

function percentChecked(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    const total = cards.length
    const checked = countValueHelper(cards, property, templates)

    return String(Math.round((checked * 100) / total)) + '%'
}

function percentUnchecked(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    const total = cards.length
    const checked = countValueHelper(cards, property, templates)

    return String(Math.round(((total - checked) * 100) / total)) + '%'
}

function countUniqueValue(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    const valueMap: Map<string | string[], boolean> = new Map()

    cards.forEach((card) => {
        const value = getCardProperty(card, property, templates)

        if (!value) {
            return
        }

        if (property.type === 'multiSelect') {
            (value as string[]).forEach((v) => valueMap.set(v, true))
        } else {
            valueMap.set(String(value), true)
        }
    })

    return String(valueMap.size)
}

function sum(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    let result = 0

    cardsWithValue(cards, property, templates).
        forEach((card) => {
            result += parseFloat(getCardProperty(card, property, templates) as string)
        })

    return String(Utils.roundTo(result, ROUNDED_DECIMAL_PLACES))
}

function average(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    const numCards = cardsWithValue(cards, property, templates).length
    if (numCards === 0) {
        return '0'
    }

    const result = parseFloat(sum(cards, property, intl, templates))
    const avg = result / numCards
    return String(Utils.roundTo(avg, ROUNDED_DECIMAL_PLACES))
}

function median(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    const sorted = cardsWithValue(cards, property, templates).
        sort((a, b) => {
            if (!getCardProperty(a, property, templates)) {
                return 1
            }

            if (!getCardProperty(b, property, templates)) {
                return -1
            }

            const aValue = parseFloat(getCardProperty(a, property, templates) as string || '0')
            const bValue = parseFloat(getCardProperty(b, property, templates) as string || '0')

            return aValue - bValue
        })

    if (sorted.length === 0) {
        return '0'
    }

    let result: number

    if (sorted.length % 2 === 0) {
        const val1 = parseFloat(getCardProperty(sorted[sorted.length / 2], property, templates) as string)
        const val2 = parseFloat(getCardProperty(sorted[(sorted.length / 2) - 1], property, templates) as string)
        result = (val1 + val2) / 2
    } else {
        result = parseFloat(getCardProperty(sorted[Math.floor(sorted.length / 2)], property, templates) as string)
    }

    return String(Utils.roundTo(result, ROUNDED_DECIMAL_PLACES))
}

function min(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    let result = Number.POSITIVE_INFINITY
    cards.forEach((card) => {
        if (!getCardProperty(card, property, templates)) {
            return
        }

        const value = parseFloat(getCardProperty(card, property, templates) as string)
        result = Math.min(result, value)
    })

    return String(result === Number.POSITIVE_INFINITY ? '0' : String(Utils.roundTo(result, ROUNDED_DECIMAL_PLACES)))
}

function max(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    let result = Number.NEGATIVE_INFINITY
    cards.forEach((card) => {
        if (!getCardProperty(card, property, templates)) {
            return
        }

        const value = parseFloat(getCardProperty(card, property, templates) as string)
        result = Math.max(result, value)
    })

    return String(result === Number.NEGATIVE_INFINITY ? '0' : String(Utils.roundTo(result, ROUNDED_DECIMAL_PLACES)))
}

function range(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    return min(cards, property, intl, templates) + ' - ' + max(cards, property, intl, templates)
}

function earliest(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    const result = earliestEpoch(cards, property, templates)
    if (result === Number.POSITIVE_INFINITY) {
        return ''
    }
    const date = new Date(result)
    return property.type === 'date' ? Utils.displayDate(date, intl) : Utils.displayDateTime(date, intl)
}

function earliestEpoch(cards: readonly Card[], property: IPropertyTemplate, templates: readonly IPropertyTemplate[]): number {
    let result = Number.POSITIVE_INFINITY
    cards.forEach((card) => {
        const timestamps = getTimestampsFromPropertyValue(getCardProperty(card, property, templates))
        for (const timestamp of timestamps) {
            result = Math.min(result, timestamp)
        }
    })
    return result
}

function latest(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    const result = latestEpoch(cards, property, templates)
    if (result === Number.NEGATIVE_INFINITY) {
        return ''
    }
    const date = new Date(result)
    return property.type === 'date' ? Utils.displayDate(date, intl) : Utils.displayDateTime(date, intl)
}

function latestEpoch(cards: readonly Card[], property: IPropertyTemplate, templates: readonly IPropertyTemplate[]): number {
    let result = Number.NEGATIVE_INFINITY
    cards.forEach((card) => {
        const timestamps = getTimestampsFromPropertyValue(getCardProperty(card, property, templates))
        for (const timestamp of timestamps) {
            result = Math.max(result, timestamp)
        }
    })
    return result
}

function getTimestampsFromPropertyValue(value: number | string | string[]): number[] {
    if (typeof value === 'number') {
        return [value]
    }
    if (typeof value === 'string') {
        let property: DateProperty
        try {
            property = JSON.parse(value)
        } catch {
            return []
        }
        return [property.from, property.to].flatMap((e) => {
            return e ? [e] : []
        })
    }
    return []
}

function dateRange(cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]): string {
    const resultEarliest = earliestEpoch(cards, property, templates)
    if (resultEarliest === Number.POSITIVE_INFINITY) {
        return ''
    }
    const resultLatest = latestEpoch(cards, property, templates)
    if (resultLatest === Number.NEGATIVE_INFINITY) {
        return ''
    }
    return humanizeDuration(resultLatest - resultEarliest, intl.locale.toLowerCase())
}

const Calculations: Record<string, (cards: readonly Card[], property: IPropertyTemplate, intl: IntlShape, templates: readonly IPropertyTemplate[]) => string> = {
    count,
    countEmpty,
    countNotEmpty,
    percentEmpty,
    percentNotEmpty,
    countValue,
    countUniqueValue,
    countChecked,
    countUnchecked,
    percentChecked,
    percentUnchecked,
    sum,
    average,
    median,
    min,
    max,
    range,
    earliest,
    latest,
    dateRange,
}

export default Calculations
