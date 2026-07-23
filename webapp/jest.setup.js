// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// jsdom does not implement scrollIntoView; React 18 fires focus handlers that
// call it during render (e.g. blocksEditor inputs with autoFocus).
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function() {}
}

// jsdom does not implement matchMedia; emoji-mart v5's Picker reads
// prefers-color-scheme on mount and throws without it.
if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = function(query) {
        return {
            matches: false,
            media: query,
            onchange: null,
            addListener: function() {},
            removeListener: function() {},
            addEventListener: function() {},
            removeEventListener: function() {},
            dispatchEvent: function() {
                return false
            },
        }
    }
}

// jsdom does not implement IntersectionObserver; emoji-mart v5's Picker
// creates one in componentDidMount (an async microtask that would otherwise
// crash the worker after the test finishes).
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
    class MockIntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
            return []
        }
    }
    window.IntersectionObserver = MockIntersectionObserver
    global.IntersectionObserver = MockIntersectionObserver
}
