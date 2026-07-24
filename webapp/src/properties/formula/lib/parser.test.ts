// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {tokenize, FormulaSyntaxError} from './tokenizer'

import {parse} from './parser'

function parseFormula(input: string) {
    return parse(tokenize(input))
}

describe('properties/formula/lib/parser', () => {
    test('parses literals', () => {
        expect(parseFormula('42')).toEqual({kind: 'number', value: 42})
        expect(parseFormula('"hi"')).toEqual({kind: 'string', value: 'hi'})
        expect(parseFormula('true')).toEqual({kind: 'bool', value: true})
    })

    test('respects arithmetic precedence: multiplication before addition', () => {
        // 1 + 2 * 3 should parse as 1 + (2 * 3), not (1 + 2) * 3
        expect(parseFormula('1 + 2 * 3')).toEqual({
            kind: 'binary',
            op: '+',
            left: {kind: 'number', value: 1},
            right: {kind: 'binary', op: '*', left: {kind: 'number', value: 2}, right: {kind: 'number', value: 3}},
        })
    })

    test('parens override precedence', () => {
        expect(parseFormula('(1 + 2) * 3')).toEqual({
            kind: 'binary',
            op: '*',
            left: {kind: 'binary', op: '+', left: {kind: 'number', value: 1}, right: {kind: 'number', value: 2}},
            right: {kind: 'number', value: 3},
        })
    })

    test('respects logical precedence: and before or', () => {
        // a or b and c should parse as a or (b and c)
        expect(parseFormula('true or false and true')).toEqual({
            kind: 'binary',
            op: 'or',
            left: {kind: 'bool', value: true},
            right: {kind: 'binary', op: 'and', left: {kind: 'bool', value: false}, right: {kind: 'bool', value: true}},
        })
    })

    test('parses unary not and unary minus', () => {
        expect(parseFormula('not true')).toEqual({kind: 'unary', op: 'not', arg: {kind: 'bool', value: true}})
        expect(parseFormula('-5')).toEqual({kind: 'unary', op: 'neg', arg: {kind: 'number', value: 5}})
    })

    test('parses a function call with multiple arguments', () => {
        expect(parseFormula('if(true, 1, 2)')).toEqual({
            kind: 'call',
            name: 'if',
            args: [{kind: 'bool', value: true}, {kind: 'number', value: 1}, {kind: 'number', value: 2}],
        })
    })

    test('parses a function call with zero arguments', () => {
        expect(parseFormula('now()')).toEqual({kind: 'call', name: 'now', args: []})
    })

    test('parses nested function calls', () => {
        expect(parseFormula('round(abs(-5))')).toEqual({
            kind: 'call',
            name: 'round',
            args: [{kind: 'call', name: 'abs', args: [{kind: 'unary', op: 'neg', arg: {kind: 'number', value: 5}}]}],
        })
    })

    test('throws on an empty formula', () => {
        expect(() => parseFormula('')).toThrow(FormulaSyntaxError)
    })

    test('throws on a trailing unexpected token', () => {
        expect(() => parseFormula('1 + 2 3')).toThrow(FormulaSyntaxError)
    })

    test('throws on a missing closing paren', () => {
        expect(() => parseFormula('(1 + 2')).toThrow(FormulaSyntaxError)
    })
})
