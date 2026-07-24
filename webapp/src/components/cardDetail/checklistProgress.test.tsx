// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, screen} from '@testing-library/react'
import '@testing-library/jest-dom'

import {TestBlockFactory} from '../../test/testBlockFactory'
import {wrapIntl} from '../../testUtils'

import ChecklistProgress from './checklistProgress'

describe('components/cardDetail/checklistProgress', () => {
    const board = TestBlockFactory.createBoard()
    const card = TestBlockFactory.createCard(board)

    test('renders nothing when there are no checkboxes', () => {
        const text = TestBlockFactory.createText(card)
        text.title = 'just plain text'

        const {container} = render(wrapIntl(<ChecklistProgress contents={[text]}/>))
        expect(container).toBeEmptyDOMElement()
    })

    test('renders the checked/total count and percentage', () => {
        const checkbox1 = TestBlockFactory.createCheckbox(card)
        checkbox1.fields.value = true
        const checkbox2 = TestBlockFactory.createCheckbox(card)
        checkbox2.fields.value = false

        render(wrapIntl(<ChecklistProgress contents={[checkbox1, checkbox2]}/>))
        expect(screen.getByText('1/2 checked (50%)')).toBeInTheDocument()
    })
})
