// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import dayjs from 'dayjs'

import {Card} from '../../../blocks/card'
import {IPropertyTemplate} from '../../../blocks/board'

import {tokenize} from './tokenizer'
import {parse, FormulaNode, BinaryOp} from './parser'

export type FormulaValue = string | number | boolean | undefined

export class FormulaEvalError extends Error {}

const MAX_DEPTH = 4

type EvalContext = {
    card: Card
    templates: readonly IPropertyTemplate[]
    depth: number
    visiting: Set<string>
}

function toNumber(v: FormulaValue): number {
    if (typeof v === 'number') {
        return v
    }
    if (typeof v === 'boolean') {
        return v ? 1 : 0
    }
    const n = parseFloat(String(v ?? ''))
    return isNaN(n) ? 0 : n
}

function toBool(v: FormulaValue): boolean {
    if (typeof v === 'boolean') {
        return v
    }
    if (typeof v === 'number') {
        return v !== 0
    }
    return Boolean(v)
}

function toStr(v: FormulaValue): string {
    if (v === undefined) {
        return ''
    }
    return String(v)
}

function looseEquals(a: FormulaValue, b: FormulaValue): boolean {
    if (typeof a === typeof b) {
        return a === b
    }
    return toStr(a) === toStr(b)
}

// parseDateProperty extracts the "from" epoch-ms timestamp from a stored date
// property value ({"from":...,"to":...} JSON, or a bare numeric string for a
// single date). This deliberately doesn't reuse DatePropertyType.getDateFrom
// (properties/date/property.tsx) - that file pulls in react-day-picker,
// mutator and modal widgets, which would drag a large, irrelevant dependency
// chain into the formula evaluator (and into every test that imports it) for
// the sake of a UTC-noon/local-midnight normalization that doesn't matter for
// day-level date arithmetic here.
function parseDateProperty(value: unknown): number | undefined {
    if (typeof value !== 'string' || !value) {
        return undefined
    }
    if ((/^\d+$/).test(value)) {
        return Number(value)
    }
    try {
        const parsed = JSON.parse(value) as {from?: number}
        return parsed.from
    } catch {
        return undefined
    }
}

function evalNode(node: FormulaNode, ctx: EvalContext): FormulaValue {
    switch (node.kind) {
    case 'number':
        return node.value
    case 'string':
        return node.value
    case 'bool':
        return node.value
    case 'unary': {
        const arg = evalNode(node.arg, ctx)
        return node.op === 'neg' ? -toNumber(arg) : !toBool(arg)
    }
    case 'binary':
        return evalBinary(node.op, evalNode(node.left, ctx), evalNode(node.right, ctx))
    case 'call':
        return evalCall(node.name, node.args, ctx)
    default:
        return undefined
    }
}

function evalBinary(op: BinaryOp, left: FormulaValue, right: FormulaValue): FormulaValue {
    switch (op) {
    case '+':
        if (typeof left === 'string' || typeof right === 'string') {
            return toStr(left) + toStr(right)
        }
        return toNumber(left) + toNumber(right)
    case '-':
        return toNumber(left) - toNumber(right)
    case '*':
        return toNumber(left) * toNumber(right)
    case '/': {
        const divisor = toNumber(right)
        return divisor === 0 ? 0 : toNumber(left) / divisor
    }
    case '%': {
        const divisor = toNumber(right)
        return divisor === 0 ? 0 : toNumber(left) % divisor
    }
    case '==':
        return looseEquals(left, right)
    case '!=':
        return !looseEquals(left, right)
    case '<':
        return toNumber(left) < toNumber(right)
    case '<=':
        return toNumber(left) <= toNumber(right)
    case '>':
        return toNumber(left) > toNumber(right)
    case '>=':
        return toNumber(left) >= toNumber(right)
    case 'and':
        return toBool(left) && toBool(right)
    case 'or':
        return toBool(left) || toBool(right)
    default:
        return undefined
    }
}

function evalCall(name: string, argNodes: FormulaNode[], ctx: EvalContext): FormulaValue {
    switch (name) {
    case 'if': {
        if (argNodes.length !== 3) {
            throw new FormulaEvalError('if() takes exactly 3 arguments: if(condition, thenValue, elseValue)')
        }
        const cond = toBool(evalNode(argNodes[0], ctx))
        return evalNode(cond ? argNodes[1] : argNodes[2], ctx)
    }
    case 'concat':
        return argNodes.map((a) => toStr(evalNode(a, ctx))).join('')
    case 'prop': {
        if (argNodes.length !== 1) {
            throw new FormulaEvalError('prop() takes exactly 1 argument: prop("Property name")')
        }
        return resolveProp(toStr(evalNode(argNodes[0], ctx)), ctx)
    }
    case 'now':
        return Date.now()
    case 'dateAdd': {
        if (argNodes.length !== 3) {
            throw new FormulaEvalError('dateAdd() takes exactly 3 arguments: dateAdd(date, amount, unit)')
        }
        const date = toNumber(evalNode(argNodes[0], ctx))
        const amount = toNumber(evalNode(argNodes[1], ctx))
        const unit = toStr(evalNode(argNodes[2], ctx))
        return dayjs(date).add(amount, unit as dayjs.ManipulateType).valueOf()
    }
    case 'dateBetween': {
        if (argNodes.length !== 3) {
            throw new FormulaEvalError('dateBetween() takes exactly 3 arguments: dateBetween(date1, date2, unit)')
        }
        const date1 = toNumber(evalNode(argNodes[0], ctx))
        const date2 = toNumber(evalNode(argNodes[1], ctx))
        const unit = toStr(evalNode(argNodes[2], ctx))
        return dayjs(date1).diff(dayjs(date2), unit as dayjs.QUnitType)
    }
    case 'round':
        requireArgCount(name, argNodes, 1)
        return Math.round(toNumber(evalNode(argNodes[0], ctx)))
    case 'abs':
        requireArgCount(name, argNodes, 1)
        return Math.abs(toNumber(evalNode(argNodes[0], ctx)))
    case 'min':
        requireMinArgCount(name, argNodes, 1)
        return Math.min(...argNodes.map((a) => toNumber(evalNode(a, ctx))))
    case 'max':
        requireMinArgCount(name, argNodes, 1)
        return Math.max(...argNodes.map((a) => toNumber(evalNode(a, ctx))))
    case 'length':
        requireArgCount(name, argNodes, 1)
        return toStr(evalNode(argNodes[0], ctx)).length
    case 'contains': {
        requireArgCount(name, argNodes, 2)
        const haystack = toStr(evalNode(argNodes[0], ctx))
        const needle = toStr(evalNode(argNodes[1], ctx))
        return haystack.includes(needle)
    }
    default:
        throw new FormulaEvalError(`Unknown function "${name}"`)
    }
}

function requireArgCount(name: string, args: FormulaNode[], count: number): void {
    if (args.length !== count) {
        throw new FormulaEvalError(`${name}() takes exactly ${count} argument${count === 1 ? '' : 's'}`)
    }
}

function requireMinArgCount(name: string, args: FormulaNode[], count: number): void {
    if (args.length < count) {
        throw new FormulaEvalError(`${name}() takes at least ${count} argument${count === 1 ? '' : 's'}`)
    }
}

function resolveProp(name: string, ctx: EvalContext): FormulaValue {
    if (name === 'Title' || name === 'title') {
        return ctx.card.title
    }

    const template = ctx.templates.find((t) => t.name === name)
    if (!template) {
        throw new FormulaEvalError(`Unknown property "${name}"`)
    }

    if (template.type === 'formula') {
        if (ctx.visiting.has(template.id)) {
            throw new FormulaEvalError(`Circular formula reference at "${name}"`)
        }
        if (ctx.depth >= MAX_DEPTH) {
            throw new FormulaEvalError(`Formula nesting too deep (max ${MAX_DEPTH} levels) at "${name}"`)
        }
        return evaluateNested(template.formula || '', {
            card: ctx.card,
            templates: ctx.templates,
            depth: ctx.depth + 1,
            visiting: new Set([...ctx.visiting, template.id]),
        })
    }

    if (template.type === 'createdBy') {
        return ctx.card.createdBy
    }
    if (template.type === 'updatedBy') {
        return ctx.card.modifiedBy
    }
    if (template.type === 'createdTime') {
        return ctx.card.createAt
    }
    if (template.type === 'updatedTime') {
        return ctx.card.updateAt
    }

    const raw = ctx.card.fields.properties[template.id]

    if (template.type === 'date') {
        return parseDateProperty(raw)
    }
    if (template.type === 'select') {
        const option = template.options.find((o) => o.id === raw)
        return option?.value
    }
    if (template.type === 'multiSelect') {
        const ids = Array.isArray(raw) ? raw : []
        return ids.map((id) => template.options.find((o) => o.id === id)?.value || '').join(', ')
    }

    if (Array.isArray(raw)) {
        return raw.join(', ')
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') {
        return raw
    }
    return raw === undefined ? undefined : String(raw)
}

function evaluateNested(formula: string, ctx: EvalContext): FormulaValue {
    if (!formula.trim()) {
        return undefined
    }
    return evalNode(parse(tokenize(formula)), ctx)
}

// Memoized by (card.id, formula, card.updateAt): re-parsing/re-evaluating on
// every render of an unchanged card is wasted work, especially once prop()
// recursion is involved. Keyed on (card.id, formula) rather than including
// updateAt in the key itself, so the map doesn't accumulate one stale entry
// per past update - each key just gets overwritten as the card changes.
const cache = new Map<string, {updateAt: number, value: FormulaValue}>()

export function evaluateFormula(formula: string, card: Card, templates: readonly IPropertyTemplate[]): FormulaValue {
    const key = `${card.id}::${formula}`
    const cached = cache.get(key)
    if (cached && cached.updateAt === card.updateAt) {
        return cached.value
    }

    let value: FormulaValue
    try {
        value = evaluateNested(formula, {card, templates, depth: 0, visiting: new Set()})
    } catch {
        value = undefined
    }

    cache.set(key, {updateAt: card.updateAt, value})
    return value
}

// evaluateFormulaOrThrow parses/evaluates without swallowing errors and
// without memoization - used by the formula editor to show a live parse/eval
// error message while the user is typing.
export function evaluateFormulaOrThrow(formula: string, card: Card, templates: readonly IPropertyTemplate[]): FormulaValue {
    return evaluateNested(formula, {card, templates, depth: 0, visiting: new Set()})
}
