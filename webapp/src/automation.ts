// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Mirrors server/model/automation.go - keep the two in sync.

export type AutomationTriggerType = 'card-created' | 'property-changed' | 'moved-to-group' | 'checklist-completed' | 'dependency-unblocked'

export type AutomationActionType = 'set-property' | 'move-to-group' | 'add-comment' | 'notify-user'

export type AutomationAction = {
    type: AutomationActionType
    config: Record<string, unknown>
}

export type AutomationRule = {
    id: string
    boardId: string
    name: string
    enabled: boolean
    triggerType: AutomationTriggerType
    triggerConfig: Record<string, unknown>
    actions: AutomationAction[]
    createdBy: string
    modifiedBy: string
    createAt: number
    updateAt: number
    deleteAt: number
}

export type AutomationRunStatus = 'success' | 'error' | 'skipped'

export type AutomationRun = {
    id: string
    ruleId: string
    cardId: string
    status: AutomationRunStatus
    error?: string
    createAt: number
}

export function createAutomationRule(): AutomationRule {
    return {
        id: '',
        boardId: '',
        name: '',
        enabled: true,
        triggerType: 'card-created',
        triggerConfig: {},
        actions: [],
        createdBy: '',
        modifiedBy: '',
        createAt: 0,
        updateAt: 0,
        deleteAt: 0,
    }
}
