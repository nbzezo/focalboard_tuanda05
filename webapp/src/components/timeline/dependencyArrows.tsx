// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useMemo} from 'react'

import {ITimelineZoom} from '../../blocks/boardView'

import {DateRange, dateToOffsetPx, getPxPerDay} from './timelineUtils'
import {ROW_HEIGHT} from './timelineRow'

import './dependencyArrows.scss'

type Props = {
    rangeByCardId: Record<string, DateRange>
    rowIndexByCardId: Record<string, number>

    // dependencyMap: blocker card ID -> IDs of cards it blocks (the same
    // shape as store/cards.ts getCardDependencyMap, reused as-is from
    // Phase 7a rather than re-deriving a timeline-specific version).
    dependencyMap: Record<string, string[]>
    viewStart: number
    zoom: ITimelineZoom
    totalWidth: number
    totalHeight: number
}

type Arrow = {
    key: string
    fromX: number
    fromY: number
    toX: number
    toY: number
    violated: boolean
}

const DependencyArrows = (props: Props): JSX.Element => {
    const {rangeByCardId, rowIndexByCardId, dependencyMap, viewStart, zoom} = props
    const pxPerDay = getPxPerDay(zoom)

    const arrows: Arrow[] = useMemo(() => {
        const result: Arrow[] = []
        for (const [blockerId, blockedIds] of Object.entries(dependencyMap)) {
            const blockerRange = rangeByCardId[blockerId]
            const blockerRowIndex = rowIndexByCardId[blockerId]
            if (!blockerRange || blockerRowIndex === undefined) {
                continue
            }

            for (const blockedId of blockedIds) {
                const blockedRange = rangeByCardId[blockedId]
                const blockedRowIndex = rowIndexByCardId[blockedId]
                if (!blockedRange || blockedRowIndex === undefined) {
                    continue
                }

                result.push({
                    key: `${blockerId}-${blockedId}`,
                    fromX: dateToOffsetPx(blockerRange.to, viewStart, zoom) + pxPerDay,
                    fromY: (blockerRowIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2),
                    toX: dateToOffsetPx(blockedRange.from, viewStart, zoom),
                    toY: (blockedRowIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2),

                    // Red when the blocked card starts before its blocker ends.
                    violated: blockedRange.from < blockerRange.to,
                })
            }
        }
        return result
    }, [dependencyMap, rangeByCardId, rowIndexByCardId, viewStart, zoom, pxPerDay])

    return (
        <svg
            className='DependencyArrows'
            width={props.totalWidth}
            height={props.totalHeight}
        >
            {arrows.map((arrow) => (
                <line
                    key={arrow.key}
                    x1={arrow.fromX}
                    y1={arrow.fromY}
                    x2={arrow.toX}
                    y2={arrow.toY}
                    className={arrow.violated ? 'DependencyArrows__line--violated' : 'DependencyArrows__line'}
                />
            ))}
        </svg>
    )
}

export default React.memo(DependencyArrows)
