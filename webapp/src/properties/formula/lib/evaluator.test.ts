// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {createCard} from '../../../blocks/card'
import {IPropertyTemplate} from '../../../blocks/board'

import {evaluateFormula, evaluateFormulaOrThrow} from './evaluator'

function makeCard(overrides: Partial<ReturnType<typeof createCard>> = {}) {
    const card = createCard()
    return {...card, ...overrides}
}

describe('properties/formula/lib/evaluator', () => {
    test('evaluates arithmetic', () => {
        expect(evaluateFormula('1 + 2 * 3', makeCard(), [])).toBe(7)
        expect(evaluateFormula('10 % 3', makeCard(), [])).toBe(1)
        expect(evaluateFormula('10 / 0', makeCard(), [])).toBe(0)
    })

    test('evaluates string concatenation via + and concat()', () => {
        expect(evaluateFormula('"a" + "b"', makeCard(), [])).toBe('ab')
        expect(evaluateFormula('concat("a", "b", "c")', makeCard(), [])).toBe('abc')
    })

    test('evaluates comparisons and logic', () => {
        expect(evaluateFormula('1 < 2', makeCard(), [])).toBe(true)
        expect(evaluateFormula('1 == 1', makeCard(), [])).toBe(true)
        expect(evaluateFormula('"a" == "a"', makeCard(), [])).toBe(true)
        expect(evaluateFormula('1 == "1"', makeCard(), [])).toBe(true)
        expect(evaluateFormula('true and false', makeCard(), [])).toBe(false)
        expect(evaluateFormula('true or false', makeCard(), [])).toBe(true)
        expect(evaluateFormula('not true', makeCard(), [])).toBe(false)
    })

    test('if() branches on the condition', () => {
        expect(evaluateFormula('if(1 < 2, "yes", "no")', makeCard(), [])).toBe('yes')
        expect(evaluateFormula('if(1 > 2, "yes", "no")', makeCard(), [])).toBe('no')
    })

    test('math helper functions', () => {
        expect(evaluateFormula('round(4.6)', makeCard(), [])).toBe(5)
        expect(evaluateFormula('abs(-4)', makeCard(), [])).toBe(4)
        expect(evaluateFormula('min(3, 1, 2)', makeCard(), [])).toBe(1)
        expect(evaluateFormula('max(3, 1, 2)', makeCard(), [])).toBe(3)
        expect(evaluateFormula('length("hello")', makeCard(), [])).toBe(5)
        expect(evaluateFormula('contains("hello world", "world")', makeCard(), [])).toBe(true)
    })

    test('prop("Title") resolves the card title', () => {
        const card = makeCard({title: 'My card'})
        expect(evaluateFormula('prop("Title")', card, [])).toBe('My card')
    })

    test('prop() resolves a text property by name', () => {
        const template: IPropertyTemplate = {id: 'p1', name: 'Status', type: 'text', options: []}
        const card = makeCard()
        card.fields.properties[template.id] = 'In progress'
        expect(evaluateFormula('prop("Status")', card, [template])).toBe('In progress')
    })

    test('prop() resolves a select property to its option label, not the raw id', () => {
        const template: IPropertyTemplate = {
            id: 'p1',
            name: 'Status',
            type: 'select',
            options: [{id: 'opt1', value: 'Done', color: 'propColorGreen'}],
        }
        const card = makeCard()
        card.fields.properties[template.id] = 'opt1'
        expect(evaluateFormula('prop("Status")', card, [template])).toBe('Done')
    })

    test('prop() on an unknown name throws', () => {
        expect(() => evaluateFormulaOrThrow('prop("Nope")', makeCard(), [])).toThrow('Unknown property "Nope"')
    })

    test('prop() referencing another formula property evaluates it recursively', () => {
        const base: IPropertyTemplate = {id: 'base', name: 'Base', type: 'number', options: []}
        const derived: IPropertyTemplate = {id: 'derived', name: 'Derived', type: 'formula', options: [], formula: 'prop("Base") * 2'}
        const card = makeCard()
        card.fields.properties[base.id] = '5'
        expect(evaluateFormula('prop("Derived") + 1', card, [base, derived])).toBe(11)
    })

    test('detects a direct circular formula reference', () => {
        const a: IPropertyTemplate = {id: 'a', name: 'A', type: 'formula', options: [], formula: 'prop("B")'}
        const b: IPropertyTemplate = {id: 'b', name: 'B', type: 'formula', options: [], formula: 'prop("A")'}
        expect(() => evaluateFormulaOrThrow('prop("A")', makeCard(), [a, b])).toThrow(/[Cc]ircular/)
    })

    test('enforces a maximum nesting depth for formula-referencing-formula chains', () => {
        const templates: IPropertyTemplate[] = []
        for (let i = 0; i < 6; i++) {
            templates.push({
                id: `f${i}`,
                name: `F${i}`,
                type: 'formula',
                options: [],
                formula: i === 0 ? '1' : `prop("F${i - 1}") + 1`,
            })
        }
        expect(() => evaluateFormulaOrThrow('prop("F5")', makeCard(), templates)).toThrow(/nesting too deep/)
    })

    test('unknown function name throws', () => {
        expect(() => evaluateFormulaOrThrow('bogus(1)', makeCard(), [])).toThrow('Unknown function "bogus"')
    })

    test('evaluateFormula swallows errors and returns undefined, unlike evaluateFormulaOrThrow', () => {
        expect(evaluateFormula('prop("Nope")', makeCard(), [])).toBeUndefined()
        expect(() => evaluateFormulaOrThrow('prop("Nope")', makeCard(), [])).toThrow()
    })

    test('memoizes by card id + formula, invalidated by updateAt', () => {
        const template: IPropertyTemplate = {id: 'p1', name: 'Status', type: 'text', options: []}
        const card = makeCard({updateAt: 100})
        card.fields.properties[template.id] = 'A'
        expect(evaluateFormula('prop("Status")', card, [template])).toBe('A')

        // Mutate the underlying value without changing updateAt - memoized result should still be returned.
        card.fields.properties[template.id] = 'B'
        expect(evaluateFormula('prop("Status")', card, [template])).toBe('A')

        // Bump updateAt - the cache entry is now stale and should be recomputed.
        const updatedCard = {...card, updateAt: 101}
        expect(evaluateFormula('prop("Status")', updatedCard, [template])).toBe('B')
    })

    test('an empty formula evaluates to undefined', () => {
        expect(evaluateFormula('', makeCard(), [])).toBeUndefined()
        expect(evaluateFormula('   ', makeCard(), [])).toBeUndefined()
    })
})
