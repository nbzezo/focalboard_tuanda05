// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {TestBlockFactory} from './test/testBlockFactory'
import {calculateChecklistProgress} from './checklistUtils'

describe('checklistUtils.calculateChecklistProgress', () => {
    const board = TestBlockFactory.createBoard()
    const card = TestBlockFactory.createCard(board)

    test('counts markdown checkboxes inside text blocks', () => {
        const text = TestBlockFactory.createText(card)
        text.title = '- [x] one\n- [ ] two\n- [x] three'

        const result = calculateChecklistProgress([text])
        expect(result).toEqual({total: 3, checked: 2})
    })

    test('counts standalone checkbox blocks', () => {
        const checkbox1 = TestBlockFactory.createCheckbox(card)
        checkbox1.fields.value = true
        const checkbox2 = TestBlockFactory.createCheckbox(card)
        checkbox2.fields.value = false

        const result = calculateChecklistProgress([checkbox1, checkbox2])
        expect(result).toEqual({total: 2, checked: 1})
    })

    test('combines text-embedded and standalone checkboxes, including nested arrays', () => {
        const text = TestBlockFactory.createText(card)
        text.title = '- [x] one'
        const checkbox = TestBlockFactory.createCheckbox(card)
        checkbox.fields.value = true

        const result = calculateChecklistProgress([text, [checkbox]])
        expect(result).toEqual({total: 2, checked: 2})
    })

    test('returns zero for content with no checkboxes', () => {
        const text = TestBlockFactory.createText(card)
        text.title = 'just plain text'

        const result = calculateChecklistProgress([text])
        expect(result).toEqual({total: 0, checked: 0})
    })
})
