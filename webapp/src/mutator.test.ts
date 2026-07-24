// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import mutator from './mutator'
import {TestBlockFactory} from './test/testBlockFactory'
import 'isomorphic-fetch'
import {FetchMock} from './test/fetchMock'
import {mockDOM} from './testUtils'
import store from './store'
import {updateCards} from './store/cards'

global.fetch = FetchMock.fn

beforeEach(() => {
    FetchMock.fn.mockReset()
})

beforeAll(() => {
    mockDOM()
})

describe('Mutator', () => {
    test('changePropertyValue', async () => {
        const board = TestBlockFactory.createBoard()
        const card = TestBlockFactory.createCard()
        card.boardId = board.id
        card.fields.properties.property_1 = 'hello'

        await mutator.changePropertyValue(board.id, card, 'property_1', 'hello')

        // No API call should be made as property value DIDN'T CHANGE
        expect(FetchMock.fn).toBeCalledTimes(0)

        await mutator.changePropertyValue(board.id, card, 'property_1', 'hello world')

        // 1 API call should be made as property value DID CHANGE
        expect(FetchMock.fn).toBeCalledTimes(1)
    })

    test('duplicateCard', async () => {
        const board = TestBlockFactory.createBoard()
        const card = TestBlockFactory.createCard(board)

        FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify([card])))
        const [newBlocks, newCardID] = await mutator.duplicateCard(card.id, board.id)

        expect(newBlocks).toHaveLength(1)

        const duplicatedCard = newBlocks[0]
        expect(duplicatedCard.type).toBe('card')
        expect(duplicatedCard.id).toBe(newCardID)
        expect(duplicatedCard.fields.icon).toBe(card.fields.icon)
        expect(duplicatedCard.fields.contentOrder).toHaveLength(card.fields.contentOrder.length)
        expect(duplicatedCard.boardId).toBe(board.id)
    })

    test('addCardDependency adds a valid dependency', async () => {
        const board = TestBlockFactory.createBoard()
        const cardA = TestBlockFactory.createCard(board)
        const cardB = TestBlockFactory.createCard(board)
        store.dispatch(updateCards([cardA, cardB]))

        FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse('{}'))
        await mutator.addCardDependency(board.id, cardA, cardB.id)

        expect(FetchMock.fn).toBeCalledTimes(1)
    })

    test('addCardDependency refuses to create a dependency cycle', async () => {
        const board = TestBlockFactory.createBoard()
        const cardA = TestBlockFactory.createCard(board)
        const cardB = TestBlockFactory.createCard(board)
        cardA.fields.blockedBy = [cardB.id]
        store.dispatch(updateCards([cardA, cardB]))

        // cardB is already (transitively) blocked by cardA, so blocking
        // cardB by cardA would create a 2-cycle - must be refused.
        await mutator.addCardDependency(board.id, cardB, cardA.id)

        expect(FetchMock.fn).toBeCalledTimes(0)
    })

    test('addCardDependency is a no-op for a self-reference', async () => {
        const board = TestBlockFactory.createBoard()
        const cardA = TestBlockFactory.createCard(board)
        store.dispatch(updateCards([cardA]))

        await mutator.addCardDependency(board.id, cardA, cardA.id)

        expect(FetchMock.fn).toBeCalledTimes(0)
    })

    test('addCardDependency is a no-op for an already-existing dependency', async () => {
        const board = TestBlockFactory.createBoard()
        const cardA = TestBlockFactory.createCard(board)
        const cardB = TestBlockFactory.createCard(board)
        cardA.fields.blockedBy = [cardB.id]
        store.dispatch(updateCards([cardA, cardB]))

        await mutator.addCardDependency(board.id, cardA, cardB.id)

        expect(FetchMock.fn).toBeCalledTimes(0)
    })

    test('removeCardDependency removes an existing dependency', async () => {
        const board = TestBlockFactory.createBoard()
        const cardA = TestBlockFactory.createCard(board)
        const cardB = TestBlockFactory.createCard(board)
        cardA.fields.blockedBy = [cardB.id]

        FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse('{}'))
        await mutator.removeCardDependency(board.id, cardA, cardB.id)

        expect(FetchMock.fn).toBeCalledTimes(1)
    })

    test('removeCardDependency is a no-op when the dependency does not exist', async () => {
        const board = TestBlockFactory.createBoard()
        const cardA = TestBlockFactory.createCard(board)

        await mutator.removeCardDependency(board.id, cardA, 'nonexistent-id')

        expect(FetchMock.fn).toBeCalledTimes(0)
    })
})
