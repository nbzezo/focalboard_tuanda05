// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {createCard} from '../../blocks/card'
import {IPropertyTemplate} from '../../blocks/board'

import {getPxPerDay, getCardDateRange, dateToOffsetPx, offsetPxToDate, barGeometry} from './timelineUtils'

const dateProperty: IPropertyTemplate = {
    id: 'due-date',
    name: 'Due date',
    type: 'date',
    options: [],
}

describe('timelineUtils.getPxPerDay', () => {
    test('returns a distinct, decreasing px-per-day for each zoom level', () => {
        expect(getPxPerDay('day')).toBeGreaterThan(getPxPerDay('week'))
        expect(getPxPerDay('week')).toBeGreaterThan(getPxPerDay('month'))
        expect(getPxPerDay('month')).toBeGreaterThan(getPxPerDay('quarter'))
    })
})

describe('timelineUtils.getCardDateRange', () => {
    test('returns undefined when the property has no value', () => {
        const card = createCard()
        expect(getCardDateRange(card, dateProperty)).toBeUndefined()
    })

    test('returns undefined for a non-string property value', () => {
        const card = createCard()
        card.fields.properties['due-date'] = ['not', 'a', 'date']
        expect(getCardDateRange(card, dateProperty)).toBeUndefined()
    })

    test('a single date (no "to") becomes a same-day range', () => {
        const card = createCard()
        card.fields.properties['due-date'] = JSON.stringify({from: Date.UTC(2024, 5, 15, 12)})

        const range = getCardDateRange(card, dateProperty)!
        expect(range).toBeDefined()
        expect(range.from).toBe(range.to)
        expect(new Date(range.from).getDate()).toBe(15)
    })

    test('a range with both "from" and "to" resolves both ends to their calendar day', () => {
        const card = createCard()
        card.fields.properties['due-date'] = JSON.stringify({
            from: Date.UTC(2024, 5, 15, 12),
            to: Date.UTC(2024, 5, 20, 12),
        })

        const range = getCardDateRange(card, dateProperty)!
        expect(new Date(range.from).getDate()).toBe(15)
        expect(new Date(range.to).getDate()).toBe(20)
        expect(range.to).toBeGreaterThan(range.from)
    })
})

describe('timelineUtils date/pixel conversion (DST fixtures)', () => {
    // eslint-disable-next-line no-process-env
    const originalTz = process.env.TZ

    beforeAll(() => {
        // America/New_York observes DST; this is the whole point of testing
        // here - a UTC or Asia/* test environment would never exercise the
        // "not every day is 24h" edge case dateToOffsetPx/offsetPxToDate
        // exist to handle, and pass even with the naive ms-division bug.
        // eslint-disable-next-line no-process-env
        process.env.TZ = 'America/New_York'
    })

    afterAll(() => {
        // eslint-disable-next-line no-process-env
        process.env.TZ = originalTz
    })

    test('round-trips a date through offsetPx and back to the same date', () => {
        const viewStart = new Date(2024, 0, 1).getTime()
        const date = new Date(2024, 5, 15).getTime()

        const offset = dateToOffsetPx(date, viewStart, 'week')
        const roundTripped = offsetPxToDate(offset, viewStart, 'week')

        expect(roundTripped).toBe(date)
    })

    test('is unaffected by the US spring-forward DST transition (2024-03-10)', () => {
        // viewStart is a week before the transition; date is two weeks after.
        // A naive (date - viewStart) / 86400000 calculation would be off by
        // one hour (1/24th of a day) for every date past the transition.
        const viewStart = new Date(2024, 2, 3).getTime() // Mar 3, before DST starts
        const date = new Date(2024, 2, 24).getTime() // Mar 24, after DST starts

        const offset = dateToOffsetPx(date, viewStart, 'day')
        const daysApart = offset / getPxPerDay('day')

        expect(daysApart).toBe(21)
    })

    test('offsetPxToDate lands exactly on local midnight even across the DST boundary', () => {
        const viewStart = new Date(2024, 2, 3).getTime()
        const pxPerDay = getPxPerDay('day')

        // 21 days after Mar 3 is Mar 24, after the "spring forward" on Mar 10.
        const result = offsetPxToDate(21 * pxPerDay, viewStart, 'day')
        const resultDate = new Date(result)

        expect(resultDate.getFullYear()).toBe(2024)
        expect(resultDate.getMonth()).toBe(2)
        expect(resultDate.getDate()).toBe(24)
        expect(resultDate.getHours()).toBe(0)
    })
})

describe('timelineUtils.barGeometry', () => {
    test('a single-day range is exactly one day wide', () => {
        const viewStart = Date.UTC(2024, 0, 1)
        const from = Date.UTC(2024, 0, 5)
        const {left, width} = barGeometry({from, to: from}, viewStart, 'day')

        expect(left).toBe(4 * getPxPerDay('day'))
        expect(width).toBe(getPxPerDay('day'))
    })

    test('a multi-day range spans the inclusive day count', () => {
        const viewStart = Date.UTC(2024, 0, 1)
        const from = Date.UTC(2024, 0, 5)
        const to = Date.UTC(2024, 0, 7) // Jan 5, 6, 7 - 3 days inclusive
        const {width} = barGeometry({from, to}, viewStart, 'day')

        expect(width).toBe(3 * getPxPerDay('day'))
    })
})
