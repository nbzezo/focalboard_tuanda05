// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Token, TokenType, FormulaSyntaxError} from './tokenizer'

export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | 'and' | 'or'

export type FormulaNode =
    | {kind: 'number', value: number}
    | {kind: 'string', value: string}
    | {kind: 'bool', value: boolean}
    | {kind: 'unary', op: 'neg' | 'not', arg: FormulaNode}
    | {kind: 'binary', op: BinaryOp, left: FormulaNode, right: FormulaNode}
    | {kind: 'call', name: string, args: FormulaNode[]}

const comparisonTypes: TokenType[] = ['lt', 'lte', 'gt', 'gte']
const multiplicativeTypes: TokenType[] = ['star', 'slash', 'percent']

// Recursive-descent parser over the fixed-precedence grammar below (lowest to
// highest): or, and, equality, comparison, additive, multiplicative, unary,
// primary. This achieves the same result as a table-driven Pratt parser for
// this grammar, with less machinery to get wrong by hand.
class Parser {
    private tokens: Token[]
    private pos = 0

    constructor(tokens: Token[]) {
        this.tokens = tokens
    }

    private peek(): Token {
        return this.tokens[this.pos]
    }

    private next(): Token {
        return this.tokens[this.pos++]
    }

    private expect(type: TokenType): Token {
        const t = this.next()
        if (t.type !== type) {
            throw new FormulaSyntaxError(`Expected "${type}" but found "${t.value || t.type}"`, t.pos)
        }
        return t
    }

    private isWordOp(word: string): boolean {
        return this.peek().type === 'ident' && this.peek().value === word
    }

    parse(): FormulaNode {
        if (this.peek().type === 'eof') {
            throw new FormulaSyntaxError('Empty formula', 0)
        }
        const node = this.parseOr()
        if (this.peek().type !== 'eof') {
            throw new FormulaSyntaxError(`Unexpected token "${this.peek().value}"`, this.peek().pos)
        }
        return node
    }

    private parseOr(): FormulaNode {
        let left = this.parseAnd()
        while (this.isWordOp('or')) {
            this.next()
            left = {kind: 'binary', op: 'or', left, right: this.parseAnd()}
        }
        return left
    }

    private parseAnd(): FormulaNode {
        let left = this.parseEquality()
        while (this.isWordOp('and')) {
            this.next()
            left = {kind: 'binary', op: 'and', left, right: this.parseEquality()}
        }
        return left
    }

    private parseEquality(): FormulaNode {
        let left = this.parseComparison()
        while (this.peek().type === 'eq' || this.peek().type === 'neq') {
            const op = this.next()
            left = {kind: 'binary', op: op.value as BinaryOp, left, right: this.parseComparison()}
        }
        return left
    }

    private parseComparison(): FormulaNode {
        let left = this.parseAdditive()
        while (comparisonTypes.includes(this.peek().type)) {
            const op = this.next()
            left = {kind: 'binary', op: op.value as BinaryOp, left, right: this.parseAdditive()}
        }
        return left
    }

    private parseAdditive(): FormulaNode {
        let left = this.parseMultiplicative()
        while (this.peek().type === 'plus' || this.peek().type === 'minus') {
            const op = this.next()
            left = {kind: 'binary', op: op.value as BinaryOp, left, right: this.parseMultiplicative()}
        }
        return left
    }

    private parseMultiplicative(): FormulaNode {
        let left = this.parseUnary()
        while (multiplicativeTypes.includes(this.peek().type)) {
            const op = this.next()
            left = {kind: 'binary', op: op.value as BinaryOp, left, right: this.parseUnary()}
        }
        return left
    }

    private parseUnary(): FormulaNode {
        if (this.peek().type === 'minus') {
            this.next()
            return {kind: 'unary', op: 'neg', arg: this.parseUnary()}
        }
        if (this.isWordOp('not')) {
            this.next()
            return {kind: 'unary', op: 'not', arg: this.parseUnary()}
        }
        return this.parsePrimary()
    }

    private parsePrimary(): FormulaNode {
        const t = this.peek()

        if (t.type === 'number') {
            this.next()
            return {kind: 'number', value: parseFloat(t.value)}
        }

        if (t.type === 'string') {
            this.next()
            return {kind: 'string', value: t.value}
        }

        if (t.type === 'ident') {
            if (t.value === 'true' || t.value === 'false') {
                this.next()
                return {kind: 'bool', value: t.value === 'true'}
            }

            this.next()
            this.expect('lparen')
            const args: FormulaNode[] = []
            if (this.peek().type !== 'rparen') {
                args.push(this.parseOr())
                while (this.peek().type === 'comma') {
                    this.next()
                    args.push(this.parseOr())
                }
            }
            this.expect('rparen')
            return {kind: 'call', name: t.value, args}
        }

        if (t.type === 'lparen') {
            this.next()
            const node = this.parseOr()
            this.expect('rparen')
            return node
        }

        throw new FormulaSyntaxError(`Unexpected token "${t.value || t.type}"`, t.pos)
    }
}

export function parse(tokens: Token[]): FormulaNode {
    return new Parser(tokens).parse()
}
