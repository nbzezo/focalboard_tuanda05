// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import createMarkdownIt from 'markdown-it'
import {MarkdownParser, MarkdownSerializer} from 'prosemirror-markdown'
import type {Node as ProseMirrorNode, Schema} from 'prosemirror-model'

type Token = createMarkdownIt.Token

// A first-party bridge between markdown text (the format Focalboard stores
// card/comment/description content in) and TipTap's ProseMirror document
// model, built directly on prosemirror-markdown + markdown-it.
//
// We do NOT use the community `tiptap-markdown` package: its published UMD
// build throws `Cannot read properties of undefined (reading 'Extension')`
// when bundled by webpack (a module-interop bug with @tiptap/core's dual
// ESM/CJS package, undetected by jest because jest's CJS resolution takes a
// different path through the package's "exports" map than webpack's does).
// The package's own README also states its author does not plan to address
// compatibility issues going forward. prosemirror-markdown (maintained by
// the ProseMirror core team) has none of these problems.
//
// The node/mark maps below are prosemirror-markdown's own default CommonMark
// rules (see defaultMarkdownParser/defaultMarkdownSerializer in
// prosemirror-markdown), re-keyed to the node/mark names and attribute names
// TipTap's StarterKit + Link actually use (e.g. "bulletList" instead of
// "bullet_list", codeBlock's language attr instead of params, orderedList's
// start attr instead of order), plus a strikethrough mapping (StarterKit's
// Strike mark) that CommonMark doesn't define, using markdown-it's "default"
// preset instead of prosemirror-markdown's stricter "commonmark" preset.

export function createMarkdownParser(schema: Schema): MarkdownParser {
    const tokenizer = createMarkdownIt('default', {html: true})
    return new MarkdownParser(schema, tokenizer, {
        blockquote: {block: 'blockquote'},
        paragraph: {block: 'paragraph'},
        list_item: {block: 'listItem'},
        bullet_list: {block: 'bulletList'},
        ordered_list: {
            block: 'orderedList',
            getAttrs: (tok: Token) => ({start: Number(tok.attrGet('start')) || 1}),
        },
        heading: {block: 'heading', getAttrs: (tok: Token) => ({level: Number(tok.tag.slice(1))})},
        code_block: {block: 'codeBlock', noCloseToken: true},
        fence: {block: 'codeBlock', getAttrs: (tok: Token) => ({language: tok.info || ''}), noCloseToken: true},
        hr: {node: 'horizontalRule'},
        hardbreak: {node: 'hardBreak'},
        em: {mark: 'italic'},
        strong: {mark: 'bold'},
        s: {mark: 'strike'},
        link: {
            mark: 'link',
            getAttrs: (tok: Token) => ({
                href: tok.attrGet('href'),
                title: tok.attrGet('title') || null,
            }),
        },
        code_inline: {mark: 'code', noCloseToken: true},
    })
}

export function createMarkdownSerializer(): MarkdownSerializer {
    return new MarkdownSerializer({
        blockquote(state, node) {
            state.wrapBlock('> ', null, node, () => state.renderContent(node))
        },
        codeBlock(state, node) {
            const backticks = node.textContent.match(/`{3,}/gm)
            const fence = backticks ? backticks.sort().slice(-1)[0] + '`' : '```'
            state.write(fence + (node.attrs.language || '') + '\n')
            state.text(node.textContent, false)
            state.write('\n')
            state.write(fence)
            state.closeBlock(node)
        },
        heading(state, node) {
            state.write(state.repeat('#', node.attrs.level) + ' ')
            state.renderInline(node, false)
            state.closeBlock(node)
        },
        horizontalRule(state, node) {
            state.write(node.attrs.markup || '---')
            state.closeBlock(node)
        },
        bulletList(state, node) {
            state.renderList(node, '  ', () => (node.attrs.bullet || '-') + ' ')
        },
        orderedList(state, node) {
            const start = node.attrs.start ?? 1
            const maxWidth = String((start + node.childCount) - 1).length
            const space = state.repeat(' ', maxWidth + 2)
            state.renderList(node, space, (i: number) => {
                const numberStr = String(start + i)
                return state.repeat(' ', (maxWidth - numberStr.length)) + (numberStr + '. ')
            })
        },
        listItem(state, node) {
            state.renderContent(node)
        },
        paragraph(state, node) {
            state.renderInline(node)
            state.closeBlock(node)
        },
        hardBreak(state, node, parent, index) {
            for (let i = index + 1; i < parent.childCount; i++) {
                if (parent.child(i).type !== node.type) {
                    state.write('\\\n')
                    return
                }
            }
        },
        text(state, node) {
            state.text(node.text || '')
        },
    }, {
        italic: {open: '*', close: '*', mixable: true, expelEnclosingWhitespace: true},
        bold: {open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true},
        strike: {open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true},
        link: {
            open: '[',
            close(_state, mark) {
                const title = mark.attrs.title ? ` "${String(mark.attrs.title).replace(/"/g, '\\"')}"` : ''
                return `](${String(mark.attrs.href).replace(/[()]/g, '\\$&')}${title})`
            },
            mixable: true,
        },
        code: {
            open(_state, _mark, parent, index) {
                return backticksFor(parent.child(index), -1)
            },
            close(_state, _mark, parent, index) {
                return backticksFor(parent.child(index - 1), 1)
            },
            escape: false,
        },
    }, {

        // TipTap's bulletList/orderedList nodes have no "tight vs loose"
        // attribute (the editor always renders list items compactly, same
        // as the old draft-js live-markdown-plugin did), so always serialize
        // lists without blank lines between items. `tightLists` is read by
        // MarkdownSerializerState at runtime but missing from this package's
        // published options type, hence the cast.
        tightLists: true,
    } as ConstructorParameters<typeof MarkdownSerializer>[2])
}

function backticksFor(node: ProseMirrorNode, side: number): string {
    const ticks = /`+/g
    let match
    let len = 0
    if (node.isText) {
        while ((match = ticks.exec(node.text || ''))) {
            len = Math.max(len, match[0].length)
        }
    }
    let result = len > 0 && side > 0 ? ' `' : '`'
    for (let i = 0; i < len; i++) {
        result += '`'
    }
    return result
}

