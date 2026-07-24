// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type TokenType =
    | 'number' | 'string' | 'ident'
    | 'lparen' | 'rparen' | 'comma'
    | 'plus' | 'minus' | 'star' | 'slash' | 'percent'
    | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
    | 'eof'

export type Token = {
    type: TokenType
    value: string
    pos: number
}

export class FormulaSyntaxError extends Error {
    pos: number

    constructor(message: string, pos: number) {
        super(message)
        this.pos = pos
    }
}

const singleCharTokens: Record<string, TokenType> = {
    '(': 'lparen',
    ')': 'rparen',
    ',': 'comma',
    '+': 'plus',
    '-': 'minus',
    '*': 'star',
    '/': 'slash',
    '%': 'percent',
}

function isDigit(c: string): boolean {
    return c >= '0' && c <= '9'
}

function isIdentStart(c: string): boolean {
    return (/[A-Za-z_]/).test(c)
}

function isIdentPart(c: string): boolean {
    return (/[A-Za-z0-9_]/).test(c)
}

// tokenize turns a formula expression into a flat token stream. Grammar
// supported: number/string/bool literals, + - * / %, == != < <= > >=, the word
// operators and/or/not, parens, commas, and bare identifiers (function names).
export function tokenize(input: string): Token[] {
    const tokens: Token[] = []
    let i = 0

    while (i < input.length) {
        const c = input[i]

        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
            i++
            continue
        }

        if (c === '"') {
            const start = i
            i++
            let value = ''
            let closed = false
            while (i < input.length) {
                if (input[i] === '"') {
                    if (input[i + 1] === '"') {
                        value += '"'
                        i += 2
                        continue
                    }
                    closed = true
                    i++
                    break
                }
                value += input[i]
                i++
            }
            if (!closed) {
                throw new FormulaSyntaxError('Unterminated string literal', start)
            }
            tokens.push({type: 'string', value, pos: start})
            continue
        }

        if (isDigit(c)) {
            const start = i
            let value = ''
            while (i < input.length && (isDigit(input[i]) || input[i] === '.')) {
                value += input[i]
                i++
            }
            tokens.push({type: 'number', value, pos: start})
            continue
        }

        if (isIdentStart(c)) {
            const start = i
            let value = ''
            while (i < input.length && isIdentPart(input[i])) {
                value += input[i]
                i++
            }
            tokens.push({type: 'ident', value, pos: start})
            continue
        }

        if (c === '=' && input[i + 1] === '=') {
            tokens.push({type: 'eq', value: '==', pos: i})
            i += 2
            continue
        }
        if (c === '!' && input[i + 1] === '=') {
            tokens.push({type: 'neq', value: '!=', pos: i})
            i += 2
            continue
        }
        if (c === '<' && input[i + 1] === '=') {
            tokens.push({type: 'lte', value: '<=', pos: i})
            i += 2
            continue
        }
        if (c === '>' && input[i + 1] === '=') {
            tokens.push({type: 'gte', value: '>=', pos: i})
            i += 2
            continue
        }
        if (c === '<') {
            tokens.push({type: 'lt', value: '<', pos: i})
            i++
            continue
        }
        if (c === '>') {
            tokens.push({type: 'gt', value: '>', pos: i})
            i++
            continue
        }

        if (singleCharTokens[c]) {
            tokens.push({type: singleCharTokens[c], value: c, pos: i})
            i++
            continue
        }

        throw new FormulaSyntaxError(`Unexpected character "${c}"`, i)
    }

    tokens.push({type: 'eof', value: '', pos: input.length})
    return tokens
}
