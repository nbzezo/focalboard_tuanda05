// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useMemo} from 'react'
import {useIntl} from 'react-intl'
import dayjs from 'dayjs'

import {Board, IPropertyTemplate} from '../../blocks/board'
import {BoardView} from '../../blocks/boardView'
import {Card} from '../../blocks/card'
import {DateProperty} from '../../properties/date/date'
import {useAppSelector} from '../../store/hooks'
import {getCardDependencyMap} from '../../store/cards'
import mutator from '../../mutator'

import {DateRange, getCardDateRange, getPxPerDay} from './timelineUtils'
import TimelineHeader from './timelineHeader'
import TimelineRow, {ROW_HEIGHT} from './timelineRow'
import DependencyArrows from './dependencyArrows'

import './timeline.scss'

type Props = {
    board: Board
    activeView: BoardView
    cards: Card[]
    dateDisplayProperty?: IPropertyTemplate
    readonly: boolean
    showCard: (cardId?: string) => void
}

const VIEW_PADDING_DAYS = 7
const DEFAULT_WINDOW_DAYS = 60

const TimelineView = (props: Props): JSX.Element => {
    const intl = useIntl()
    const {board, activeView, cards, dateDisplayProperty, readonly} = props
    const zoom = activeView.fields.timelineZoom
    const dependencyMap = useAppSelector(getCardDependencyMap)

    const {scheduled, unscheduled} = useMemo(() => {
        const scheduledList: Array<{card: Card, range: DateRange}> = []
        const unscheduledList: Card[] = []
        for (const card of cards) {
            const range = dateDisplayProperty ? getCardDateRange(card, dateDisplayProperty) : undefined
            if (range) {
                scheduledList.push({card, range})
            } else {
                unscheduledList.push(card)
            }
        }
        return {scheduled: scheduledList, unscheduled: unscheduledList}
    }, [cards, dateDisplayProperty])

    const {viewStart, totalDays} = useMemo(() => {
        if (scheduled.length === 0) {
            return {
                viewStart: dayjs().startOf('month').subtract(VIEW_PADDING_DAYS, 'day').valueOf(),
                totalDays: DEFAULT_WINDOW_DAYS,
            }
        }
        const minFrom = Math.min(...scheduled.map((s) => s.range.from))
        const maxTo = Math.max(...scheduled.map((s) => s.range.to))
        const start = dayjs(minFrom).startOf('day').subtract(VIEW_PADDING_DAYS, 'day')
        const end = dayjs(maxTo).startOf('day').add(VIEW_PADDING_DAYS, 'day')
        return {
            viewStart: start.valueOf(),
            totalDays: Math.max(end.diff(start, 'day'), DEFAULT_WINDOW_DAYS),
        }
    }, [scheduled])

    const rangeByCardId = useMemo(() => {
        const map: Record<string, DateRange> = {}
        for (const s of scheduled) {
            map[s.card.id] = s.range
        }
        return map
    }, [scheduled])

    const rowIndexByCardId = useMemo(() => {
        const map: Record<string, number> = {}
        scheduled.forEach((s, index) => {
            map[s.card.id] = index
        })
        return map
    }, [scheduled])

    const pxPerDay = getPxPerDay(zoom)
    const totalWidth = totalDays * pxPerDay
    const totalHeight = scheduled.length * ROW_HEIGHT

    const handleChange = (card: Card, newFrom: number, newTo: number) => {
        if (!dateDisplayProperty) {
            return
        }
        const oldRange = rangeByCardId[card.id]
        const newDateProperty: DateProperty = {
            from: newFrom,
            to: newTo === newFrom ? undefined : newTo,
        }
        mutator.changePropertyValue(
            board.id,
            card,
            dateDisplayProperty.id,
            JSON.stringify(newDateProperty),
            oldRange ? 'move timeline bar' : 'schedule card',
        )
    }

    if (!dateDisplayProperty) {
        return (
            <div className='Timeline Timeline--empty'>
                {intl.formatMessage({
                    id: 'Timeline.no-date-property',
                    defaultMessage: 'Add a date property to this board, then pick it from "Display by" above to use the timeline view.',
                })}
            </div>
        )
    }

    return (
        <div className='Timeline'>
            <div className='Timeline__scroll'>
                <TimelineHeader
                    viewStart={viewStart}
                    totalDays={totalDays}
                    zoom={zoom}
                />
                <div
                    className='Timeline__body'
                    style={{width: totalWidth, height: totalHeight}}
                >
                    {activeView.fields.showDependencies &&
                        <DependencyArrows
                            rangeByCardId={rangeByCardId}
                            rowIndexByCardId={rowIndexByCardId}
                            dependencyMap={dependencyMap}
                            viewStart={viewStart}
                            zoom={zoom}
                            totalWidth={totalWidth}
                            totalHeight={totalHeight}
                        />}
                    {scheduled.map(({card, range}) => (
                        <TimelineRow
                            key={card.id}
                            card={card}
                            range={range}
                            viewStart={viewStart}
                            zoom={zoom}
                            readonly={readonly}
                            isBlocked={(card.fields.blockedBy || []).length > 0}
                            onShowCard={() => props.showCard(card.id)}
                            onChange={(newFrom, newTo) => handleChange(card, newFrom, newTo)}
                        />
                    ))}
                </div>
            </div>
            {unscheduled.length > 0 &&
                <div className='Timeline__unscheduled'>
                    <div className='Timeline__unscheduled-label'>
                        {intl.formatMessage({id: 'Timeline.unscheduled', defaultMessage: 'Unscheduled'})}
                    </div>
                    {unscheduled.map((card) => (
                        <div
                            key={card.id}
                            className='Timeline__unscheduled-card'
                            onClick={() => props.showCard(card.id)}
                        >
                            {card.title || 'Untitled'}
                        </div>
                    ))}
                </div>}
        </div>
    )
}

export default React.memo(TimelineView)
