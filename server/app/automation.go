// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/focalboard/server/model"
)

func (a *App) GetAutomationRules(boardID string) ([]*model.AutomationRule, error) {
	return a.store.GetAutomationRules(boardID)
}

func (a *App) GetAutomationRule(ruleID string) (*model.AutomationRule, error) {
	return a.store.GetAutomationRule(ruleID)
}

func (a *App) UpsertAutomationRule(rule *model.AutomationRule, userID string) (*model.AutomationRule, error) {
	rule.ModifiedBy = userID
	if rule.CreatedBy == "" {
		rule.CreatedBy = userID
	}
	return a.store.UpsertAutomationRule(rule)
}

func (a *App) DeleteAutomationRule(ruleID string) error {
	return a.store.DeleteAutomationRule(ruleID)
}

func (a *App) GetAutomationRuns(ruleID string, opts model.QueryAutomationRunOptions) ([]*model.AutomationRun, error) {
	return a.store.GetAutomationRuns(ruleID, opts)
}
