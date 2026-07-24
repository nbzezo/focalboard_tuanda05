// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import dayjs from 'dayjs'

import {Card} from '../../blocks/card'
import {IPropertyTemplate} from '../../blocks/board'
import {ITimelineZoom} from '../../blocks/boardView'
import {DatePropertyType} from '../../properties/types'
import propsRegistry from '../../properties'

export type DateRange = {
    from: number
    to: number
}

// Pixels per calendar day at each zoom level.
const pxPerDayByZoom: Record<ITimelineZoom, number> = {
    day: 80,
    week: 24,
    month: 8,
    quarter: 3,
}

export function getPxPerDay(zoom: ITimelineZoom): number {
    return pxPerDayByZoom[zoom]
}

// getCardDateRange resolves a card's {from, to} range (epoch ms) for the given
// date property, reusing the same PropertyType.getDateFrom/getDateTo used by
// calendar view (fullCalendar.tsx) rather than re-parsing the raw JSON value
// directly - that abstraction already accounts for the "date properties are
// stored as 12pm UTC, normalize to local midnight" quirk (see
// properties/date/property.tsx), which a from-scratch parser would silently
// get wrong. A card with only "from" set (a single date, not a range) becomes
// a same-day range. Returns undefined when the property has no value - the
// caller puts those cards in the "Unscheduled" tray instead of a bar.
export function getCardDateRange(card: Card, property: IPropertyTemplate): DateRange | undefined {
    const propertyType = propsRegistry.get(property.type)
    if (!(propertyType instanceof DatePropertyType)) {
        return undefined
    }

    const value = card.fields.properties[property.id]
    const from = propertyType.getDateFrom(value, card)
    if (!from) {
        return undefined
    }

    const to = propertyType.getDateTo(value, card)
    return {
        from: from.getTime(),
        to: to ? to.getTime() : from.getTime(),
    }
}

// dateToOffsetPx / offsetPxToDate convert between an epoch-ms date and its
// pixel offset from viewStart. Both go through dayjs' startOf('day')/diff/add
// in calendar-day units rather than naive ms division: a fixed 24h-per-day
// assumption silently misplaces bars by an hour on the days a DST transition
// happens, since not every calendar day is exactly 24 hours long.
export function dateToOffsetPx(date: number, viewStart: number, zoom: ITimelineZoom): number {
    const days = dayjs(date).startOf('day').diff(dayjs(viewStart).startOf('day'), 'day')
    return days * getPxPerDay(zoom)
}

export function offsetPxToDate(offsetPx: number, viewStart: number, zoom: ITimelineZoom): number {
    const days = Math.round(offsetPx / getPxPerDay(zoom))
    return dayjs(viewStart).startOf('day').add(days, 'day').valueOf()
}

// barGeometry returns the left offset and width (in px) for a card's bar,
// clamped to at least one day wide so a single-date card is still visible.
export function barGeometry(range: DateRange, viewStart: number, zoom: ITimelineZoom): {left: number, width: number} {
    const left = dateToOffsetPx(range.from, viewStart, zoom)
    const rawWidth = dateToOffsetPx(range.to, viewStart, zoom) - left
    const pxPerDay = getPxPerDay(zoom)
    return {
        left,
        width: Math.max(rawWidth + pxPerDay, pxPerDay),
    }
}
