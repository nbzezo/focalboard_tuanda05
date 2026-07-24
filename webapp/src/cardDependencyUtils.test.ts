// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Card, createCard} from './blocks/card'
import {wouldCreateCycle} from './cardDependencyUtils'

function card(id: string, blockedBy: string[] = []): Card {
    const c = createCard()
    c.id = id
    c.fields.blockedBy = blockedBy
    return c
}

function byId(cards: Card[]): Record<string, Card> {
    const map: Record<string, Card> = {}
    for (const c of cards) {
        map[c.id] = c
    }
    return map
}

describe('cardDependencyUtils.wouldCreateCycle', () => {
    test('a card cannot be blocked by itself', () => {
        const cards = byId([card('a')])
        expect(wouldCreateCycle(cards, 'a', 'a')).toBe(true)
    })

    test('no cycle when the candidate blocker has no dependencies of its own', () => {
        const cards = byId([card('a'), card('b')])
        expect(wouldCreateCycle(cards, 'a', 'b')).toBe(false)
    })

    test('detects a direct 2-cycle (A blockedBy B, proposing B blockedBy A)', () => {
        const cards = byId([card('a', ['b']), card('b')])
        expect(wouldCreateCycle(cards, 'b', 'a')).toBe(true)
    })

    test('detects a transitive 3-cycle (A blockedBy B blockedBy C, proposing C blockedBy A)', () => {
        const cards = byId([card('a', ['b']), card('b', ['c']), card('c')])
        expect(wouldCreateCycle(cards, 'c', 'a')).toBe(true)
    })

    test('allows a diamond dependency shape (not a cycle)', () => {
        // a blockedBy b, a blockedBy c, b blockedBy d, c blockedBy d - no cycle
        const cards = byId([card('a', ['b', 'c']), card('b', ['d']), card('c', ['d']), card('d')])
        expect(wouldCreateCycle(cards, 'a', 'd')).toBe(false)
    })

    test('ignores unrelated cards', () => {
        const cards = byId([card('a'), card('b'), card('unrelated', ['a'])])
        expect(wouldCreateCycle(cards, 'a', 'b')).toBe(false)
    })
})
