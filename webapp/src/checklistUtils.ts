// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {ContentBlock} from './blocks/contentBlock'
import {Utils} from './utils'

export type ChecklistProgress = {
    total: number
    checked: number
}

// Shared by cardBadges.tsx (kanban/table badge) and checklistProgress.tsx
// (card detail progress bar) so both count checkboxes - both standalone
// checkbox content blocks and markdown checkboxes embedded in text blocks -
// the same way.
export function calculateChecklistProgress(contents: Array<ContentBlock | ContentBlock[]>): ChecklistProgress {
    let total = 0
    let checked = 0

    const updateCounters = (block: ContentBlock) => {
        if (block.type === 'text') {
            const checkboxes = Utils.countCheckboxesInMarkdown(block.title)
            total += checkboxes.total
            checked += checkboxes.checked
        } else if (block.type === 'checkbox') {
            total++
            if (block.fields.value) {
                checked++
            }
        }
    }

    for (const content of contents) {
        if (Array.isArray(content)) {
            content.forEach(updateCounters)
        } else {
            updateCounters(content)
        }
    }
    return {total, checked}
}
