// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package automation

import "github.com/mattermost/focalboard/server/model"

// ruleStore is the subset of store.Store the engine needs to look up rules and log
// runs. It's satisfied structurally by store.Store (no adapter needed) and is
// available at Backend-construction time, before *app.App exists - unlike
// ActionExecutor below, which needs *app.App and so is injected later.
type ruleStore interface {
	GetAutomationRules(boardID string) ([]*model.AutomationRule, error)
	CreateAutomationRun(run *model.AutomationRun) (*model.AutomationRun, error)
	GetBlocksWithParentAndType(boardID, parentID string, blockType string) ([]*model.Block, error)
	GetBlocksWithType(boardID, blockType string) ([]*model.Block, error)
	GetBlock(blockID string) (*model.Block, error)

	// used by the notify-user action: subscribes the target user to the card so
	// they see it as a followed card, and so the plugin-mode subscription
	// delivery pipeline (when active) picks it up like any other card follow.
	CreateSubscription(sub *model.Subscription) (*model.Subscription, error)
}

// ActionExecutor is the subset of *app.App needed to execute automation actions.
// app.New() requires the notify.Service (and therefore this backend) to already
// exist, so the backend can't depend on *app.App at construction time - it's
// injected via Backend.SetActionExecutor immediately after app.New() returns
// (see server/server.go), rather than passed into New().
type ActionExecutor interface {
	PatchBlockAndNotify(blockID string, blockPatch *model.BlockPatch, modifiedByID string, disableNotify bool) (*model.Block, error)
	InsertBlockAndNotify(block *model.Block, modifiedByID string, disableNotify bool) error
}
