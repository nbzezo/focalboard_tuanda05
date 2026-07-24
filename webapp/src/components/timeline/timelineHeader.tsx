// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useMemo} from 'react'
import dayjs from 'dayjs'

import {ITimelineZoom} from '../../blocks/boardView'

import {getPxPerDay} from './timelineUtils'

import './timelineHeader.scss'

type Props = {
    viewStart: number
    totalDays: number
    zoom: ITimelineZoom
}

// Number of calendar days between tick marks at each zoom level.
const tickIntervalDaysByZoom: Record<ITimelineZoom, number> = {
    day: 1,
    week: 7,
    month: 30,
    quarter: 90,
}

const tickFormatByZoom: Record<ITimelineZoom, string> = {
    day: 'MMM D',
    week: 'MMM D',
    month: 'MMM YYYY',
    quarter: 'MMM YYYY',
}

const TimelineHeader = (props: Props): JSX.Element => {
    const {viewStart, totalDays, zoom} = props
    const pxPerDay = getPxPerDay(zoom)
    const intervalDays = tickIntervalDaysByZoom[zoom]
    const format = tickFormatByZoom[zoom]

    const ticks = useMemo(() => {
        const result: Array<{left: number, label: string}> = []
        for (let day = 0; day < totalDays; day += intervalDays) {
            result.push({
                left: day * pxPerDay,
                label: dayjs(viewStart).add(day, 'day').format(format),
            })
        }
        return result
    }, [viewStart, totalDays, intervalDays, pxPerDay, format])

    return (
        <div
            className='TimelineHeader'
            style={{width: totalDays * pxPerDay}}
        >
            {ticks.map((tick) => (
                <div
                    key={tick.left}
                    className='TimelineHeader__tick'
                    style={{left: tick.left}}
                >
                    {tick.label}
                </div>
            ))}
        </div>
    )
}

export default React.memo(TimelineHeader)
