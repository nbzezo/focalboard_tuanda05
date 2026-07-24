// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useEffect, useRef, useState} from 'react'
import dayjs from 'dayjs'

import {Card} from '../../blocks/card'
import {ITimelineZoom} from '../../blocks/boardView'

import {DateRange, barGeometry, getPxPerDay} from './timelineUtils'

import './timelineRow.scss'

export const ROW_HEIGHT = 40

type Props = {
    card: Card
    range: DateRange
    viewStart: number
    zoom: ITimelineZoom
    readonly: boolean
    isBlocked: boolean
    onShowCard: () => void
    onChange: (newFrom: number, newTo: number) => void
}

type DragMode = 'move' | 'resize-end'

const TimelineRow = (props: Props): JSX.Element => {
    const {card, range, viewStart, zoom, readonly} = props
    const pxPerDay = getPxPerDay(zoom)

    const [dragMode, setDragMode] = useState<DragMode | null>(null)
    const [previewOffsetDays, setPreviewOffsetDays] = useState(0)

    // Read inside the mouseup handler via ref rather than the state value
    // captured at mousedown time - keeps the document listener's own effect
    // from needing to re-subscribe on every pixel of mouse movement.
    const previewOffsetDaysRef = useRef(0)
    const dragStartXRef = useRef(0)
    const draggedRef = useRef(false)

    const handleMouseDown = useCallback((e: React.MouseEvent, mode: DragMode) => {
        if (readonly) {
            return
        }
        e.preventDefault()
        e.stopPropagation()
        dragStartXRef.current = e.clientX
        draggedRef.current = false
        previewOffsetDaysRef.current = 0
        setDragMode(mode)
    }, [readonly])

    useEffect(() => {
        if (!dragMode) {
            return undefined
        }

        const handleMouseMove = (e: MouseEvent) => {
            const deltaPx = e.clientX - dragStartXRef.current
            const deltaDays = Math.round(deltaPx / pxPerDay)
            if (deltaDays !== 0) {
                draggedRef.current = true
            }
            previewOffsetDaysRef.current = deltaDays
            setPreviewOffsetDays(deltaDays)
        }

        const handleMouseUp = () => {
            const deltaDays = previewOffsetDaysRef.current
            if (deltaDays !== 0) {
                if (dragMode === 'move') {
                    const newFrom = dayjs(range.from).add(deltaDays, 'day').valueOf()
                    const newTo = dayjs(range.to).add(deltaDays, 'day').valueOf()
                    props.onChange(newFrom, newTo)
                } else {
                    const newTo = dayjs(range.to).add(deltaDays, 'day').valueOf()
                    if (newTo >= range.from) {
                        props.onChange(range.from, newTo)
                    }
                }
            }
            setDragMode(null)
            setPreviewOffsetDays(0)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        // range/props.onChange intentionally excluded: this effect only needs
        // to (re)bind when a drag starts or ends (dragMode changes); reading
        // range/onChange fresh on every mousemove would tear down and rebind
        // the listeners on every pixel of movement.
    }, [dragMode, pxPerDay])

    const {left, width} = barGeometry(range, viewStart, zoom)
    const previewDeltaPx = previewOffsetDays * pxPerDay
    const displayLeft = dragMode === 'move' ? left + previewDeltaPx : left
    const displayWidth = dragMode === 'resize-end' ? Math.max(width + previewDeltaPx, pxPerDay) : width

    return (
        <div
            className='TimelineRow'
            style={{height: ROW_HEIGHT}}
        >
            <div
                className={'TimelineRow__bar' + (props.isBlocked ? ' TimelineRow__bar--blocked' : '') + (dragMode ? ' TimelineRow__bar--dragging' : '')}
                style={{left: displayLeft, width: displayWidth}}
                title={card.title || 'Untitled'}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
                onClick={() => {
                    if (!draggedRef.current) {
                        props.onShowCard()
                    }
                }}
            >
                <span className='TimelineRow__title'>{card.title || 'Untitled'}</span>
                {!readonly &&
                    <div
                        className='TimelineRow__resize-handle'
                        onMouseDown={(e) => handleMouseDown(e, 'resize-end')}
                    />}
            </div>
        </div>
    )
}

export default React.memo(TimelineRow)
