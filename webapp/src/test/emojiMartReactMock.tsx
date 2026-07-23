// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Jest stub for @emoji-mart/react. The real Picker renders asynchronously via
// preact and relies on browser APIs (IntersectionObserver, matchMedia) that
// jsdom lacks; letting it mount makes tests non-deterministic and can crash
// the worker. This stub renders a single selectable button so the
// select -> onEmojiSelect integration can still be exercised.
import React from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Picker = (props: any): JSX.Element => (
    <button
        aria-label='thumbsup'
        onClick={() => props.onEmojiSelect?.({native: '👍', id: 'thumbsup', shortcodes: ':+1:'})}
    >
        {'👍'}
    </button>
)

export default Picker
