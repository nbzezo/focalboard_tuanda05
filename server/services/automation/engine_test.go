// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package automation

import (
	"testing"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/notify"
	"github.com/stretchr/testify/require"
)

func TestBackendBlockChanged(t *testing.T) {
	t.Run("matching enabled rule executes its action", func(t *testing.T) {
		store := newFakeStore()
		store.rules["board1"] = []*model.AutomationRule{
			{
				ID: "rule1", BoardID: "board1", Enabled: true,
				TriggerType: model.TriggerCardCreated,
				Actions:     []model.AutomationAction{{Type: model.ActionSetProperty, Config: map[string]interface{}{"propertyId": "status", "value": "todo"}}},
			},
		}
		store.blocksByID["card1"] = &model.Block{ID: "card1", BoardID: "board1", Fields: map[string]interface{}{}}

		b := newTestBackend(t, store)
		executor := &fakeExecutor{}
		b.SetActionExecutor(executor)

		evt := notify.BlockChangeEvent{
			Action:       notify.Add,
			Board:        &model.Board{ID: "board1"},
			BlockChanged: &model.Block{ID: "card1", BoardID: "board1", Type: model.TypeCard},
			ModifiedBy:   &model.BoardMember{UserID: "human1"},
		}

		err := b.BlockChanged(evt)
		require.NoError(t, err)
		require.Len(t, executor.patches, 1)
		require.Len(t, store.runs, 1)
		require.Equal(t, model.RunStatusSuccess, store.runs[0].Status)
	})

	t.Run("disabled rule is skipped", func(t *testing.T) {
		store := newFakeStore()
		store.rules["board1"] = []*model.AutomationRule{
			{
				ID: "rule1", BoardID: "board1", Enabled: false,
				TriggerType: model.TriggerCardCreated,
				Actions:     []model.AutomationAction{{Type: model.ActionSetProperty, Config: map[string]interface{}{"propertyId": "status", "value": "todo"}}},
			},
		}
		b := newTestBackend(t, store)
		b.SetActionExecutor(&fakeExecutor{})

		evt := notify.BlockChangeEvent{
			Action:       notify.Add,
			Board:        &model.Board{ID: "board1"},
			BlockChanged: &model.Block{ID: "card1", BoardID: "board1", Type: model.TypeCard},
			ModifiedBy:   &model.BoardMember{UserID: "human1"},
		}

		err := b.BlockChanged(evt)
		require.NoError(t, err)
		require.Empty(t, store.runs)
	})

	t.Run("events authored by the automation bot itself are ignored", func(t *testing.T) {
		store := newFakeStore()
		store.rules["board1"] = []*model.AutomationRule{
			{
				ID: "rule1", BoardID: "board1", Enabled: true,
				TriggerType: model.TriggerCardCreated,
				Actions:     []model.AutomationAction{{Type: model.ActionSetProperty, Config: map[string]interface{}{"propertyId": "status", "value": "todo"}}},
			},
		}
		b := newTestBackend(t, store)
		executor := &fakeExecutor{}
		b.SetActionExecutor(executor)

		evt := notify.BlockChangeEvent{
			Action:       notify.Add,
			Board:        &model.Board{ID: "board1"},
			BlockChanged: &model.Block{ID: "card1", BoardID: "board1", Type: model.TypeCard},
			ModifiedBy:   &model.BoardMember{UserID: BotUserID},
		}

		err := b.BlockChanged(evt)
		require.NoError(t, err)
		require.Empty(t, executor.patches)
		require.Zero(t, store.getRulesCallCount, "should short-circuit before even looking up rules")
	})

	t.Run("rule list is cached across calls for the same board", func(t *testing.T) {
		store := newFakeStore()
		store.rules["board1"] = []*model.AutomationRule{}
		b := newTestBackend(t, store)
		b.SetActionExecutor(&fakeExecutor{})

		evt := notify.BlockChangeEvent{
			Action:       notify.Add,
			Board:        &model.Board{ID: "board1"},
			BlockChanged: &model.Block{ID: "card1", BoardID: "board1", Type: model.TypeCard},
			ModifiedBy:   &model.BoardMember{UserID: "human1"},
		}

		require.NoError(t, b.BlockChanged(evt))
		require.NoError(t, b.BlockChanged(evt))
		require.Equal(t, 1, store.getRulesCallCount)

		b.InvalidateCache("board1")
		require.NoError(t, b.BlockChanged(evt))
		require.Equal(t, 2, store.getRulesCallCount)
	})

	t.Run("nil board or block is a no-op, not a panic", func(t *testing.T) {
		store := newFakeStore()
		b := newTestBackend(t, store)
		b.SetActionExecutor(&fakeExecutor{})

		require.NoError(t, b.BlockChanged(notify.BlockChangeEvent{}))
	})
}
