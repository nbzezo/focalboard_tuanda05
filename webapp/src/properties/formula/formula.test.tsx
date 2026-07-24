// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {ComponentProps} from 'react'
import {render, screen, act} from '@testing-library/react'
import '@testing-library/jest-dom'
import {mocked} from 'jest-mock'
import userEvent from '@testing-library/user-event'

import {wrapIntl} from '../../testUtils'
import {TestBlockFactory} from '../../test/testBlockFactory'
import mutator from '../../mutator'
import {Board, IPropertyTemplate} from '../../blocks/board'
import {Card} from '../../blocks/card'

import FormulaProperty from './property'
import FormulaProp from './formula'

jest.mock('../../mutator')

const mockedMutator = mocked(mutator)

describe('properties/formula', () => {
    let board: Board
    let card: Card
    let propertyTemplate: IPropertyTemplate
    let baseProps: ComponentProps<typeof FormulaProp>

    beforeEach(() => {
        jest.clearAllMocks()
        board = TestBlockFactory.createBoard()
        card = TestBlockFactory.createCard(board)
        propertyTemplate = {id: 'formula1', name: 'My formula', type: 'formula', options: [], formula: '1 + 2'}

        baseProps = {
            property: new FormulaProperty(),
            card,
            board,
            propertyTemplate,
            propertyValue: '',
            readOnly: false,
            showEmptyPlaceholder: true,
        }
    })

    test('shows the evaluated value, not the raw formula text', () => {
        render(wrapIntl(<FormulaProp {...baseProps}/>))
        expect(screen.getByText('3')).toBeInTheDocument()
        expect(screen.queryByText('1 + 2')).not.toBeInTheDocument()
    })

    test('shows the empty placeholder when there is no formula yet', () => {
        const emptyTemplate = {...propertyTemplate, formula: ''}
        render(wrapIntl(
            <FormulaProp
                {...baseProps}
                propertyTemplate={emptyTemplate}
            />,
        ))
        expect(screen.getByText('Empty')).toBeInTheDocument()
    })

    test('readOnly never enters edit mode', async () => {
        render(wrapIntl(
            <FormulaProp
                {...baseProps}
                readOnly={true}
            />,
        ))
        await userEvent.click(screen.getByText('3'))
        expect(screen.queryByPlaceholderText(/e\.g\./)).not.toBeInTheDocument()
    })

    test('clicking the value reveals an editable formula input, saved on blur', async () => {
        render(wrapIntl(<FormulaProp {...baseProps}/>))

        await userEvent.click(screen.getByText('3'))
        const input = screen.getByDisplayValue('1 + 2')
        await userEvent.clear(input)
        await userEvent.type(input, '10 * 2')
        act(() => {
            input.blur()
        })

        expect(mockedMutator.changePropertyFormula).toHaveBeenCalledWith(board.id, board.cardProperties, propertyTemplate, '10 * 2')
    })

    test('an invalid formula is not saved and shows a parse error', async () => {
        render(wrapIntl(<FormulaProp {...baseProps}/>))

        await userEvent.click(screen.getByText('3'))
        const input = screen.getByDisplayValue('1 + 2')
        await userEvent.clear(input)
        await userEvent.type(input, '1 +')
        act(() => {
            input.blur()
        })

        expect(mockedMutator.changePropertyFormula).not.toHaveBeenCalled()
        expect(screen.getByText(/Unexpected token/)).toBeInTheDocument()
    })
})
