// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import durationPlugin from 'dayjs/plugin/duration'
import localeData from 'dayjs/plugin/localeData'
import relativeTime from 'dayjs/plugin/relativeTime'
import type {Locale} from 'date-fns'
import * as dateFnsLocales from 'date-fns/locale'

dayjs.extend(customParseFormat)
dayjs.extend(durationPlugin)
dayjs.extend(localeData)
dayjs.extend(relativeTime)

const loadedLocales: Record<string, string> = {}

// dayjs' bundled default 'en' locale is minimal and lacks longDateFormat
// data, so we explicitly load dayjs/locale/en.js once (it registers the full
// 'en' locale incl. `formats`).
// eslint-disable-next-line global-require
require('dayjs/locale/en.js')

// Loads the dayjs locale bundle for the given BCP-47 tag (lowercased) and
// returns the dayjs locale name that is actually available, falling back to
// the base language and finally to 'en'.
export function loadDayjsLocale(locale: string): string {
    const normalized = locale.toLowerCase()
    if (normalized === 'en' || normalized === 'en-us') {
        return 'en'
    }
    if (loadedLocales[normalized]) {
        return loadedLocales[normalized]
    }
    try {
        // eslint-disable-next-line global-require
        require(`dayjs/locale/${normalized}.js`)
        loadedLocales[normalized] = normalized
        return normalized
    } catch {
        const base = normalized.split('-')[0]
        if (base !== normalized) {
            try {
                // eslint-disable-next-line global-require
                require(`dayjs/locale/${base}.js`)
                loadedLocales[normalized] = base
                return base
            } catch {
                // fall through to 'en'
            }
        }
    }
    loadedLocales[normalized] = 'en'
    return 'en'
}

// Locale-aware short date format ("L" in moment terms), e.g. MM/DD/YYYY.
export function localeDateFormat(locale: string): string {
    const l = loadDayjsLocale(locale)
    try {
        return dayjs().locale(l).localeData().longDateFormat('L') || 'MM/DD/YYYY'
    } catch {
        return 'MM/DD/YYYY'
    }
}

// Parses user input typed in the locale's short date format.
export function parseInputDate(input: string, locale: string): Date | undefined {
    const l = loadDayjsLocale(locale)
    const parsed = dayjs(input, localeDateFormat(l), l)
    return parsed.isValid() ? parsed.toDate() : undefined
}

// "3 days ago" style relative time.
export function relativeDate(date: Date, locale: string): string {
    const l = loadDayjsLocale(locale)
    return dayjs(date).locale(l).fromNow()
}

// "2 months" style humanized duration for a span in milliseconds.
export function humanizeDuration(ms: number, locale: string): string {
    const l = loadDayjsLocale(locale)
    return dayjs.duration(ms, 'milliseconds').locale(l).humanize()
}

// Maps a BCP-47 tag to a date-fns Locale object for react-day-picker.
// Returns undefined for English/unknown locales (DayPicker defaults to en-US).
export function getDateFnsLocale(locale: string): Locale | undefined {
    const [base, region] = locale.toLowerCase().split('-')
    const key = region ? base + region.toUpperCase() : base
    const locales = dateFnsLocales as unknown as Record<string, Locale>
    return locales[key] ?? locales[base]
}
