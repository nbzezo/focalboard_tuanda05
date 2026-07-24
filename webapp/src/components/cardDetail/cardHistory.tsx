// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react'
import {useIntl} from 'react-intl'

import {Block} from '../../blocks/block'
import {Board} from '../../blocks/board'
import {Card} from '../../blocks/card'
import octoClient from '../../octoClient'
import {Utils} from '../../utils'
import Dialog from '../dialog'

import './cardHistory.scss'

type Props = {
    card: Card
    board: Board
    onClose: () => void
}

export type HistoryChange = {
    title: boolean
    propertyNames: string[]
    contentCountChange?: {from: number, to: number}
}

// diffHistoryEntries compares two adjacent block_history rows for the same
// card (newer vs. the version right before it) across exactly the three
// dimensions worth surfacing in a lightweight history view: title, property
// values (resolved to their template names), and content block count.
export function diffHistoryEntries(newer: Block, older: Block, board: Board): HistoryChange {
    const propertyNames: string[] = []
    const newerProps = (newer.fields?.properties || {}) as Record<string, unknown>
    const olderProps = (older.fields?.properties || {}) as Record<string, unknown>
    const propertyIds = new Set([...Object.keys(newerProps), ...Object.keys(olderProps)])
    for (const propertyId of propertyIds) {
        if (JSON.stringify(newerProps[propertyId]) !== JSON.stringify(olderProps[propertyId])) {
            const template = board.cardProperties.find((p) => p.id === propertyId)
            propertyNames.push(template?.name || propertyId)
        }
    }

    const newerContentCount = (newer.fields?.contentOrder || []).length
    const olderContentCount = (older.fields?.contentOrder || []).length

    return {
        title: newer.title !== older.title,
        propertyNames,
        contentCountChange: newerContentCount === olderContentCount ? undefined : {from: olderContentCount, to: newerContentCount},
    }
}

const CardHistory = (props: Props): JSX.Element => {
    const intl = useIntl()
    const [history, setHistory] = useState<Block[]>([])

    useEffect(() => {
        let cancelled = false
        octoClient.getBlockHistory(props.card.boardId, props.card.id).then((blocks) => {
            if (!cancelled) {
                setHistory(blocks)
            }
        })
        return () => {
            cancelled = true
        }
    }, [props.card.boardId, props.card.id])

    return (
        <Dialog
            title={<>{intl.formatMessage({id: 'CardHistory.title', defaultMessage: 'Card history'})}</>}
            className='CardHistory'
            onClose={props.onClose}
        >
            {history.length === 0 &&
                <div className='CardHistory__empty'>
                    {intl.formatMessage({id: 'CardHistory.empty', defaultMessage: 'No history yet'})}
                </div>}
            {history.map((entry, i) => {
                const older = history[i + 1]
                const change = older ? diffHistoryEntries(entry, older, props.board) : undefined
                const hasVisibleChange = change && (change.title || change.propertyNames.length > 0 || change.contentCountChange)
                return (
                    <div
                        key={entry.updateAt}
                        className='CardHistory__entry'
                    >
                        <div className='CardHistory__date'>{Utils.displayDateTime(new Date(entry.updateAt), intl)}</div>
                        {!older &&
                            <div className='CardHistory__change'>
                                {intl.formatMessage({id: 'CardHistory.created', defaultMessage: 'Card created'})}
                            </div>}
                        {change?.title &&
                            <div className='CardHistory__change'>
                                {intl.formatMessage({id: 'CardHistory.title-changed', defaultMessage: 'Title changed'})}
                            </div>}
                        {change?.propertyNames.map((name) => (
                            <div
                                key={name}
                                className='CardHistory__change'
                            >
                                {intl.formatMessage({id: 'CardHistory.property-changed', defaultMessage: '{name} changed'}, {name})}
                            </div>
                        ))}
                        {change?.contentCountChange &&
                            <div className='CardHistory__change'>
                                {intl.formatMessage(
                                    {id: 'CardHistory.content-changed', defaultMessage: 'Content changed ({from} → {to} blocks)'},
                                    {from: change.contentCountChange.from, to: change.contentCountChange.to},
                                )}
                            </div>}
                        {older && !hasVisibleChange &&
                            <div className='CardHistory__change'>
                                {intl.formatMessage({id: 'CardHistory.no-visible-changes', defaultMessage: 'No visible changes'})}
                            </div>}
                    </div>
                )
            })}
        </Dialog>
    )
}

export default React.memo(CardHistory)
