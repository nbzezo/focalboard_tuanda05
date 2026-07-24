// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Card, createCard} from './blocks/card'
import {IPropertyTemplate} from './blocks/board'
import {groupCardsTwoLevels} from './boardUtils'

// swimlaneOptionId groups by the outer axis (priority); columnOptionId groups
// by the inner axis (status) - matching groupCardsTwoLevels(cards, ..., groupByProperty=status, swimlaneByProperty=priority).
function card(swimlaneOptionId: string, columnOptionId: string): Card {
    const c = createCard()
    c.id = `card-${swimlaneOptionId}-${columnOptionId}-${Math.random()}`
    c.fields.properties = {priority: swimlaneOptionId, status: columnOptionId}
    return c
}

describe('boardUtils.groupCardsTwoLevels', () => {
    const statusProperty: IPropertyTemplate = {
        id: 'status',
        name: 'Status',
        type: 'select',
        options: [
            {id: 'todo', value: 'To Do', color: 'propColorDefault'},
            {id: 'done', value: 'Done', color: 'propColorDefault'},
        ],
    }
    const priorityProperty: IPropertyTemplate = {
        id: 'priority',
        name: 'Priority',
        type: 'select',
        options: [
            {id: 'high', value: 'High', color: 'propColorDefault'},
            {id: 'low', value: 'Low', color: 'propColorDefault'},
        ],
    }

    test('groups cards by swimlane (outer) then by column (inner)', () => {
        const cards = [
            card('high', 'todo'),
            card('high', 'done'),
            card('low', 'todo'),
        ]

        const swimlanes = groupCardsTwoLevels(cards, ['todo', 'done'], [], statusProperty, priorityProperty)

        expect(swimlanes.map((s) => s.option.id).sort()).toEqual(['', 'high', 'low'].sort())

        const highSwimlane = swimlanes.find((s) => s.option.id === 'high')!
        expect(highSwimlane.cards).toHaveLength(2)
        expect(highSwimlane.groups.find((g) => g.option.id === 'todo')?.cards).toHaveLength(1)
        expect(highSwimlane.groups.find((g) => g.option.id === 'done')?.cards).toHaveLength(1)

        const lowSwimlane = swimlanes.find((s) => s.option.id === 'low')!
        expect(lowSwimlane.cards).toHaveLength(1)
        expect(lowSwimlane.groups.find((g) => g.option.id === 'todo')?.cards).toHaveLength(1)
    })

    test('always includes the empty ("no value") swimlane', () => {
        const cards = [card('high', 'todo')]
        const swimlanes = groupCardsTwoLevels(cards, ['todo', 'done'], [], statusProperty, priorityProperty)
        expect(swimlanes.some((s) => s.option.id === '')).toBe(true)
    })

    test('cards with an unknown swimlane option value fall into the empty swimlane', () => {
        const cards = [card('deleted-option-id', 'todo')]
        const swimlanes = groupCardsTwoLevels(cards, ['todo', 'done'], [], statusProperty, priorityProperty)
        const emptySwimlane = swimlanes.find((s) => s.option.id === '')!
        expect(emptySwimlane.cards).toHaveLength(1)
    })

    test('respects hiddenOptionIds for the inner column grouping', () => {
        const cards = [card('high', 'todo'), card('high', 'done')]
        const swimlanes = groupCardsTwoLevels(cards, ['todo'], ['done'], statusProperty, priorityProperty)
        const highSwimlane = swimlanes.find((s) => s.option.id === 'high')!
        expect(highSwimlane.groups.map((g) => g.option.id)).not.toContain('done')
        expect(highSwimlane.groups.find((g) => g.option.id === 'todo')?.cards).toHaveLength(1)
    })
})
