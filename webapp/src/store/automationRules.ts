// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, PayloadAction, createAsyncThunk} from '@reduxjs/toolkit'

import {default as client} from '../octoClient'
import {AutomationRule} from '../automation'

import {RootState} from './index'

type AutomationRulesState = {
    rulesByBoard: {[boardId: string]: AutomationRule[]}
    loading: boolean
}

const initialState: AutomationRulesState = {
    rulesByBoard: {},
    loading: false,
}

export const fetchAutomationRules = createAsyncThunk(
    'automationRules/fetch',
    async (boardId: string) => {
        const rules = await client.getAutomationRules(boardId)
        return {boardId, rules}
    },
)

export const saveAutomationRule = createAsyncThunk(
    'automationRules/save',
    async ({boardId, rule}: {boardId: string, rule: AutomationRule}) => {
        const saved = rule.id ? await client.updateAutomationRule(boardId, rule) : await client.createAutomationRule(boardId, rule)
        return {boardId, rule: saved}
    },
)

export const removeAutomationRule = createAsyncThunk(
    'automationRules/remove',
    async ({boardId, ruleId}: {boardId: string, ruleId: string}) => {
        await client.deleteAutomationRule(boardId, ruleId)
        return {boardId, ruleId}
    },
)

const automationRulesSlice = createSlice({
    name: 'automationRules',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchAutomationRules.pending, (state) => {
            state.loading = true
        })
        builder.addCase(fetchAutomationRules.fulfilled, (state, action: PayloadAction<{boardId: string, rules: AutomationRule[]}>) => {
            state.loading = false
            state.rulesByBoard[action.payload.boardId] = action.payload.rules
        })
        builder.addCase(fetchAutomationRules.rejected, (state) => {
            state.loading = false
        })
        builder.addCase(saveAutomationRule.fulfilled, (state, action: PayloadAction<{boardId: string, rule?: AutomationRule}>) => {
            const {boardId, rule} = action.payload
            if (!rule) {
                return
            }
            const existing = state.rulesByBoard[boardId] || []
            const index = existing.findIndex((r) => r.id === rule.id)
            if (index === -1) {
                state.rulesByBoard[boardId] = [...existing, rule]
            } else {
                state.rulesByBoard[boardId] = existing.map((r, i) => (i === index ? rule : r))
            }
        })
        builder.addCase(removeAutomationRule.fulfilled, (state, action: PayloadAction<{boardId: string, ruleId: string}>) => {
            const {boardId, ruleId} = action.payload
            state.rulesByBoard[boardId] = (state.rulesByBoard[boardId] || []).filter((r) => r.id !== ruleId)
        })
    },
})

export const {reducer} = automationRulesSlice

export const getAutomationRules = (boardId: string) => (state: RootState): AutomationRule[] => state.automationRules.rulesByBoard[boardId] || []
export const getAutomationRulesLoading = (state: RootState): boolean => state.automationRules.loading
