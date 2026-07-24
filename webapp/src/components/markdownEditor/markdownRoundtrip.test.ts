// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Focalboard stores card/comment/description content as a plain markdown
// STRING in block.title. The TipTap editor (webapp/src/components/
// markdownEditor/tiptapEditor.tsx) is a WYSIWYG view over that string: on
// load we parse the markdown into a ProseMirror doc, and on every change we
// serialize the doc back to markdown text via markdownBridge.ts (our own
// parser/serializer built on prosemirror-markdown -- see that file's header
// comment for why we don't use the community tiptap-markdown package). This
// test guards that round-trip: markdown in must produce (an idempotent)
// markdown out, for every construct the old draft-js live-markdown-plugin
// supported (bold/italic/strikethrough/inline-code/headings/quote/lists/
// code-block) so no migration of stored data is ever required.
//
// A corpus fixture (not live card data, which wasn't available) covering the
// old plugin's supported syntax, plus mentions and emoji (see "Editor
// extensions" section of the Phase 4 handoff notes for why those are plain
// text rather than custom nodes).
import {getSchema} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

import {createMarkdownParser, createMarkdownSerializer} from './markdownBridge'

const schema = getSchema([StarterKit])
const parser = createMarkdownParser(schema)
const serializer = createMarkdownSerializer()

function markdownToMarkdown(markdown: string): string {
    const doc = parser.parse(markdown)
    return serializer.serialize(doc)
}

describe('markdownEditor/markdownRoundtrip', () => {
    test('plain text', () => {
        expect(markdownToMarkdown('hello world')).toBe('hello world')
    })

    test('bold', () => {
        expect(markdownToMarkdown('this is **bold** text')).toBe('this is **bold** text')
    })

    test('italic (marker normalized to *, semantically identical)', () => {
        // The serializer canonicalizes the emphasis marker to '*' regardless
        // of source syntax. This does not lose or alter meaning (both render
        // as <em>) and is stable on re-save (see the idempotency test below)
        // -- it just means underscore-italic text becomes asterisk-italic
        // the first time it's edited and re-saved.
        expect(markdownToMarkdown('this is _italic_ text')).toBe('this is *italic* text')
    })

    test('strikethrough', () => {
        expect(markdownToMarkdown('this is ~~struck out~~ text')).toBe('this is ~~struck out~~ text')
    })

    test('inline code', () => {
        expect(markdownToMarkdown('this is `inline code`')).toBe('this is `inline code`')
    })

    test('combined bold + italic (marker normalized, semantically identical)', () => {
        expect(markdownToMarkdown('this is _**bold italic**_ text')).toBe('this is ***bold italic*** text')
    })

    test('heading levels 1-3', () => {
        expect(markdownToMarkdown('# Heading 1')).toBe('# Heading 1')
        expect(markdownToMarkdown('## Heading 2')).toBe('## Heading 2')
        expect(markdownToMarkdown('### Heading 3')).toBe('### Heading 3')
    })

    test('blockquote', () => {
        expect(markdownToMarkdown('> a quoted line')).toBe('> a quoted line')
    })

    test('unordered list', () => {
        const md = '- item 1\n- item 2\n- item 3'
        expect(markdownToMarkdown(md)).toBe(md)
    })

    test('ordered list', () => {
        const md = '1. item 1\n2. item 2\n3. item 3'
        expect(markdownToMarkdown(md)).toBe(md)
    })

    test('code block', () => {
        const md = '```\nconst x = 1\nconsole.log(x)\n```'
        expect(markdownToMarkdown(md)).toBe(md)
    })

    test('link', () => {
        expect(markdownToMarkdown('see [the docs](https://example.com/docs)')).toBe('see [the docs](https://example.com/docs)')
    })

    test('multi-paragraph text', () => {
        const md = 'first paragraph\n\nsecond paragraph'
        expect(markdownToMarkdown(md)).toBe(md)
    })

    test('mention token as plain text', () => {
        expect(markdownToMarkdown('hey @jane.doe can you review this?')).toBe('hey @jane.doe can you review this?')
    })

    test('emoji as plain unicode text', () => {
        expect(markdownToMarkdown('nice work 👍 great job 🎉')).toBe('nice work 👍 great job 🎉')
    })

    test('is idempotent when re-serializing the same content twice', () => {
        const md = '## Release notes\n\n- **Fixed**: login bug\n- *Improved*: `Editor` performance\n\n> Ship it!'
        const once = markdownToMarkdown(md)
        const twice = markdownToMarkdown(once)
        expect(twice).toBe(once)
    })
})
