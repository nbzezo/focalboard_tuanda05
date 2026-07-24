// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package automation

import (
	"testing"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/notify"
	"github.com/stretchr/testify/require"
)

func TestMatchCardCreated(t *testing.T) {
	rule := &model.AutomationRule{TriggerType: model.TriggerCardCreated}
	store := newFakeStore()

	t.Run("matches a newly added card", func(t *testing.T) {
		evt := notify.BlockChangeEvent{
			Action:       notify.Add,
			BlockChanged: &model.Block{ID: "card1", Type: model.TypeCard},
		}
		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Equal(t, []string{"card1"}, matched)
	})

	t.Run("does not match an update", func(t *testing.T) {
		evt := notify.BlockChangeEvent{
			Action:       notify.Update,
			BlockChanged: &model.Block{ID: "card1", Type: model.TypeCard},
		}
		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Empty(t, matched)
	})

	t.Run("does not match a non-card block", func(t *testing.T) {
		evt := notify.BlockChangeEvent{
			Action:       notify.Add,
			BlockChanged: &model.Block{ID: "view1", Type: model.TypeView},
		}
		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Empty(t, matched)
	})
}

func TestMatchPropertyChanged(t *testing.T) {
	store := newFakeStore()

	t.Run("matches when the configured property value changes", func(t *testing.T) {
		rule := &model.AutomationRule{
			TriggerType:   model.TriggerPropertyChanged,
			TriggerConfig: map[string]interface{}{"propertyId": "status"},
		}
		evt := notify.BlockChangeEvent{
			Action: notify.Update,
			BlockOld: &model.Block{
				ID: "card1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "todo"}},
			},
			BlockChanged: &model.Block{
				ID: "card1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "done"}},
			},
		}
		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Equal(t, []string{"card1"}, matched)
	})

	t.Run("does not match when the configured property is unchanged", func(t *testing.T) {
		rule := &model.AutomationRule{
			TriggerType:   model.TriggerPropertyChanged,
			TriggerConfig: map[string]interface{}{"propertyId": "status"},
		}
		evt := notify.BlockChangeEvent{
			Action: notify.Update,
			BlockOld: &model.Block{
				ID: "card1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "todo", "other": "x"}},
			},
			BlockChanged: &model.Block{
				ID: "card1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "todo", "other": "y"}},
			},
		}
		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Empty(t, matched)
	})

	t.Run("respects toValue filter", func(t *testing.T) {
		rule := &model.AutomationRule{
			TriggerType:   model.TriggerPropertyChanged,
			TriggerConfig: map[string]interface{}{"propertyId": "status", "toValue": "done"},
		}
		evt := notify.BlockChangeEvent{
			Action: notify.Update,
			BlockOld: &model.Block{
				ID: "card1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "todo"}},
			},
			BlockChanged: &model.Block{
				ID: "card1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "in-progress"}},
			},
		}
		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Empty(t, matched)
	})
}

func TestMatchChecklistCompleted(t *testing.T) {
	rule := &model.AutomationRule{TriggerType: model.TriggerChecklistCompleted}

	t.Run("matches when every sibling checkbox is checked", func(t *testing.T) {
		store := newFakeStore()
		store.blocksByParent["card1"] = []*model.Block{
			{ID: "cb1", Type: model.TypeCheckbox, Fields: map[string]interface{}{"value": true}},
			{ID: "cb2", Type: model.TypeCheckbox, Fields: map[string]interface{}{"value": true}},
		}
		evt := notify.BlockChangeEvent{
			Action:       notify.Update,
			Board:        &model.Board{ID: "board1"},
			Card:         &model.Block{ID: "card1"},
			BlockChanged: &model.Block{ID: "cb2", Type: model.TypeCheckbox},
		}
		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Equal(t, []string{"card1"}, matched)
	})

	t.Run("does not match when a sibling is still unchecked", func(t *testing.T) {
		store := newFakeStore()
		store.blocksByParent["card1"] = []*model.Block{
			{ID: "cb1", Type: model.TypeCheckbox, Fields: map[string]interface{}{"value": true}},
			{ID: "cb2", Type: model.TypeCheckbox, Fields: map[string]interface{}{"value": false}},
		}
		evt := notify.BlockChangeEvent{
			Action:       notify.Update,
			Board:        &model.Board{ID: "board1"},
			Card:         &model.Block{ID: "card1"},
			BlockChanged: &model.Block{ID: "cb1", Type: model.TypeCheckbox},
		}
		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Empty(t, matched)
	})
}

func TestMatchDependencyUnblocked(t *testing.T) {
	rule := &model.AutomationRule{
		TriggerType:   model.TriggerDependencyUnblocked,
		TriggerConfig: map[string]interface{}{"propertyId": "status", "doneValue": "done"},
	}

	t.Run("fires for a card whose only blocker just became done", func(t *testing.T) {
		store := newFakeStore()
		blockedCard := &model.Block{
			ID: "blocked1", Type: model.TypeCard,
			Fields: map[string]interface{}{"blockedBy": []interface{}{"blocker1"}},
		}
		store.blocksByType["board1"] = []*model.Block{blockedCard}

		evt := notify.BlockChangeEvent{
			Action: notify.Update,
			Board:  &model.Board{ID: "board1"},
			BlockOld: &model.Block{
				ID: "blocker1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "in-progress"}},
			},
			BlockChanged: &model.Block{
				ID: "blocker1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "done"}},
			},
		}
		// allBlockersDone looks the blocker up in the full board card list too.
		store.blocksByType["board1"] = append(store.blocksByType["board1"], evt.BlockChanged)

		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Equal(t, []string{"blocked1"}, matched)
	})

	t.Run("does not fire when another blocker is still not done", func(t *testing.T) {
		store := newFakeStore()
		blockedCard := &model.Block{
			ID: "blocked1", Type: model.TypeCard,
			Fields: map[string]interface{}{"blockedBy": []interface{}{"blocker1", "blocker2"}},
		}
		blocker2 := &model.Block{
			ID: "blocker2", Type: model.TypeCard,
			Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "todo"}},
		}
		evt := notify.BlockChangeEvent{
			Action: notify.Update,
			Board:  &model.Board{ID: "board1"},
			BlockOld: &model.Block{
				ID: "blocker1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "in-progress"}},
			},
			BlockChanged: &model.Block{
				ID: "blocker1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "done"}},
			},
		}
		store.blocksByType["board1"] = []*model.Block{blockedCard, blocker2, evt.BlockChanged}

		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Empty(t, matched)
	})

	t.Run("does not re-fire on a no-op update once already done", func(t *testing.T) {
		store := newFakeStore()
		evt := notify.BlockChangeEvent{
			Action: notify.Update,
			Board:  &model.Board{ID: "board1"},
			BlockOld: &model.Block{
				ID: "blocker1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "done"}},
			},
			BlockChanged: &model.Block{
				ID: "blocker1", Type: model.TypeCard,
				Fields: map[string]interface{}{"properties": map[string]interface{}{"status": "done"}},
			},
		}
		matched, err := matchTrigger(rule, evt, store)
		require.NoError(t, err)
		require.Empty(t, matched)
	})
}
