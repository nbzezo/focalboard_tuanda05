// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package automation

import (
	"testing"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/require"
)

func newTestBackend(t *testing.T, store *fakeStore) *Backend {
	return New(store, mlog.CreateConsoleTestLogger(t))
}

func TestExecuteSetPropertyAction(t *testing.T) {
	store := newFakeStore()
	card := &model.Block{
		ID: "card1", BoardID: "board1", Title: "Card 1",
		Fields: map[string]interface{}{"properties": map[string]interface{}{"other": "keep-me"}},
	}
	store.blocksByID["card1"] = card

	b := newTestBackend(t, store)
	executor := &fakeExecutor{}
	b.SetActionExecutor(executor)

	rule := &model.AutomationRule{
		ID: "rule1",
		Actions: []model.AutomationAction{
			{Type: model.ActionSetProperty, Config: map[string]interface{}{"propertyId": "status", "value": "done"}},
		},
	}

	err := b.executeActions(rule, "card1")
	require.NoError(t, err)
	require.Len(t, executor.patches, 1)

	patch := executor.patches[0]
	require.Equal(t, "card1", patch.blockID)
	require.Equal(t, BotUserID, patch.modifiedByID)
	require.True(t, patch.disableNotify, "automation writes must disable notify to avoid re-triggering rules")

	properties := patch.patch.UpdatedFields["properties"].(map[string]interface{})
	require.Equal(t, "done", properties["status"])
	require.Equal(t, "keep-me", properties["other"], "existing properties must be preserved, not clobbered")
}

func TestExecuteAddCommentAction(t *testing.T) {
	store := newFakeStore()
	card := &model.Block{ID: "card1", BoardID: "board1", Title: "Buy groceries", Fields: map[string]interface{}{}}
	store.blocksByID["card1"] = card

	b := newTestBackend(t, store)
	executor := &fakeExecutor{}
	b.SetActionExecutor(executor)

	rule := &model.AutomationRule{
		ID: "rule1",
		Actions: []model.AutomationAction{
			{Type: model.ActionAddComment, Config: map[string]interface{}{"message": "Card {{card.title}} is done"}},
		},
	}

	err := b.executeActions(rule, "card1")
	require.NoError(t, err)
	require.Len(t, executor.insertedBlock, 1)

	comment := executor.insertedBlock[0]
	require.EqualValues(t, model.TypeComment, comment.Type)
	require.Equal(t, "card1", comment.ParentID)
	require.Equal(t, "Card Buy groceries is done", comment.Title)
	require.Equal(t, BotUserID, comment.ModifiedBy)
}

func TestExecuteNotifyUserAction(t *testing.T) {
	store := newFakeStore()
	card := &model.Block{ID: "card1", BoardID: "board1", Title: "Card 1", Fields: map[string]interface{}{}}
	store.blocksByID["card1"] = card

	b := newTestBackend(t, store)
	b.SetActionExecutor(&fakeExecutor{})

	rule := &model.AutomationRule{
		ID: "rule1",
		Actions: []model.AutomationAction{
			{Type: model.ActionNotifyUser, Config: map[string]interface{}{"userId": "user1", "message": "heads up"}},
		},
	}

	err := b.executeActions(rule, "card1")
	require.NoError(t, err)
	require.Len(t, store.subscriptions, 1)
	require.Equal(t, "user1", store.subscriptions[0].SubscriberID)
	require.Equal(t, "card1", store.subscriptions[0].BlockID)
}

func TestExecuteActionsFailsWithoutExecutor(t *testing.T) {
	store := newFakeStore()
	store.blocksByID["card1"] = &model.Block{ID: "card1", BoardID: "board1", Fields: map[string]interface{}{}}

	b := newTestBackend(t, store)
	// deliberately not calling SetActionExecutor - simulates the narrow startup
	// window before app.New() completes.

	rule := &model.AutomationRule{
		ID:      "rule1",
		Actions: []model.AutomationAction{{Type: model.ActionSetProperty, Config: map[string]interface{}{"propertyId": "x", "value": "y"}}},
	}

	err := b.executeActions(rule, "card1")
	require.Error(t, err)
}
