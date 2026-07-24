// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {tokenize, FormulaSyntaxError} from './tokenizer'

describe('properties/formula/lib/tokenizer', () => {
    test('tokenizes numbers, including decimals', () => {
        expect(tokenize('42').map((t) => t.type)).toEqual(['number', 'eof'])
        expect(tokenize('3.14')[0]).toMatchObject({type: 'number', value: '3.14'})
    })

    test('tokenizes a string literal with escaped quotes', () => {
        const tokens = tokenize('"say ""hi"""')
        expect(tokens[0]).toMatchObject({type: 'string', value: 'say "hi"'})
    })

    test('throws on an unterminated string literal', () => {
        expect(() => tokenize('"unterminated')).toThrow(FormulaSyntaxError)
    })

    test('tokenizes identifiers, including word operators', () => {
        expect(tokenize('and or not prop true false').map((t) => t.value)).toEqual(
            ['and', 'or', 'not', 'prop', 'true', 'false', ''],
        )
    })

    test('tokenizes comparison and equality operators, longest match first', () => {
        const types = tokenize('== != <= >= < >').map((t) => t.type)
        expect(types).toEqual(['eq', 'neq', 'lte', 'gte', 'lt', 'gt', 'eof'])
    })

    test('tokenizes arithmetic operators and punctuation', () => {
        const types = tokenize('+ - * / % ( ) ,').map((t) => t.type)
        expect(types).toEqual(['plus', 'minus', 'star', 'slash', 'percent', 'lparen', 'rparen', 'comma', 'eof'])
    })

    test('skips whitespace', () => {
        expect(tokenize('  1   +   2  ').map((t) => t.type)).toEqual(['number', 'plus', 'number', 'eof'])
    })

    test('throws on an unexpected character with its position', () => {
        expect(() => tokenize('1 @ 2')).toThrow(FormulaSyntaxError)
        try {
            tokenize('1 @ 2')
            fail('expected a throw')
        } catch (e) {
            expect((e as FormulaSyntaxError).pos).toBe(2)
        }
    })
})
