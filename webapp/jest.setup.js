// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// jsdom does not implement scrollIntoView; React 18 fires focus handlers that
// call it during render (e.g. blocksEditor inputs with autoFocus).
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function() {}
}
