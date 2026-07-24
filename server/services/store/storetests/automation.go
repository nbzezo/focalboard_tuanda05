// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/store"
	"github.com/mattermost/focalboard/server/utils"
)

func StoreTestAutomationStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	t.Run("UpsertAutomationRule - create", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testCreateAutomationRule(t, store)
	})

	t.Run("UpsertAutomationRule - update", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testUpdateAutomationRule(t, store)
	})

	t.Run("GetAutomationRules", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetAutomationRules(t, store)
	})

	t.Run("DeleteAutomationRule", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testDeleteAutomationRule(t, store)
	})

	t.Run("AutomationRuns", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testAutomationRuns(t, store)
	})
}

func testCreateAutomationRule(t *testing.T, s store.Store) {
	users := createTestUsers(t, s, 1)
	boards := createTestBoards(t, s, utils.NewID(utils.IDTypeTeam), users[0].ID, 1)

	rule := &model.AutomationRule{
		BoardID:       boards[0].ID,
		Name:          "Mark done when checklist completes",
		Enabled:       true,
		TriggerType:   model.TriggerChecklistCompleted,
		TriggerConfig: map[string]interface{}{},
		Actions: []model.AutomationAction{
			{Type: model.ActionSetProperty, Config: map[string]interface{}{"propertyId": "status", "value": "done"}},
		},
		CreatedBy: users[0].ID,
	}

	saved, err := s.UpsertAutomationRule(rule)
	require.NoError(t, err)
	require.NotEmpty(t, saved.ID)
	require.Equal(t, rule.Name, saved.Name)
	require.NotZero(t, saved.CreateAt)

	fetched, err := s.GetAutomationRule(saved.ID)
	require.NoError(t, err)
	require.Equal(t, saved.Name, fetched.Name)
	require.Equal(t, saved.TriggerType, fetched.TriggerType)
	require.Len(t, fetched.Actions, 1)
	require.Equal(t, model.ActionSetProperty, fetched.Actions[0].Type)
	require.Equal(t, "status", fetched.Actions[0].Config["propertyId"])
}

func testUpdateAutomationRule(t *testing.T, s store.Store) {
	users := createTestUsers(t, s, 1)
	boards := createTestBoards(t, s, utils.NewID(utils.IDTypeTeam), users[0].ID, 1)

	rule := &model.AutomationRule{
		BoardID:       boards[0].ID,
		Name:          "Original name",
		Enabled:       true,
		TriggerType:   model.TriggerCardCreated,
		TriggerConfig: map[string]interface{}{},
		Actions:       []model.AutomationAction{{Type: model.ActionAddComment, Config: map[string]interface{}{"message": "hi"}}},
		CreatedBy:     users[0].ID,
	}
	saved, err := s.UpsertAutomationRule(rule)
	require.NoError(t, err)

	saved.Name = "Updated name"
	saved.Enabled = false
	updated, err := s.UpsertAutomationRule(saved)
	require.NoError(t, err)
	require.Equal(t, saved.ID, updated.ID)
	require.Equal(t, "Updated name", updated.Name)
	require.False(t, updated.Enabled)
	require.Equal(t, saved.CreateAt, updated.CreateAt, "create_at must be preserved across an update")

	fetched, err := s.GetAutomationRule(saved.ID)
	require.NoError(t, err)
	require.Equal(t, "Updated name", fetched.Name)
	require.False(t, fetched.Enabled)
}

func testGetAutomationRules(t *testing.T, s store.Store) {
	users := createTestUsers(t, s, 1)
	boards := createTestBoards(t, s, utils.NewID(utils.IDTypeTeam), users[0].ID, 2)

	for i := 0; i < 3; i++ {
		_, err := s.UpsertAutomationRule(&model.AutomationRule{
			BoardID:       boards[0].ID,
			Name:          "rule",
			TriggerType:   model.TriggerCardCreated,
			TriggerConfig: map[string]interface{}{},
			Actions:       []model.AutomationAction{{Type: model.ActionAddComment, Config: map[string]interface{}{"message": "hi"}}},
			CreatedBy:     users[0].ID,
		})
		require.NoError(t, err)
	}
	_, err := s.UpsertAutomationRule(&model.AutomationRule{
		BoardID:       boards[1].ID,
		Name:          "other board rule",
		TriggerType:   model.TriggerCardCreated,
		TriggerConfig: map[string]interface{}{},
		Actions:       []model.AutomationAction{{Type: model.ActionAddComment, Config: map[string]interface{}{"message": "hi"}}},
		CreatedBy:     users[0].ID,
	})
	require.NoError(t, err)

	rules, err := s.GetAutomationRules(boards[0].ID)
	require.NoError(t, err)
	require.Len(t, rules, 3)

	otherRules, err := s.GetAutomationRules(boards[1].ID)
	require.NoError(t, err)
	require.Len(t, otherRules, 1)
}

func testDeleteAutomationRule(t *testing.T, s store.Store) {
	users := createTestUsers(t, s, 1)
	boards := createTestBoards(t, s, utils.NewID(utils.IDTypeTeam), users[0].ID, 1)

	saved, err := s.UpsertAutomationRule(&model.AutomationRule{
		BoardID:       boards[0].ID,
		Name:          "to delete",
		TriggerType:   model.TriggerCardCreated,
		TriggerConfig: map[string]interface{}{},
		Actions:       []model.AutomationAction{{Type: model.ActionAddComment, Config: map[string]interface{}{"message": "hi"}}},
		CreatedBy:     users[0].ID,
	})
	require.NoError(t, err)

	err = s.DeleteAutomationRule(saved.ID)
	require.NoError(t, err)

	_, err = s.GetAutomationRule(saved.ID)
	require.Error(t, err)

	rules, err := s.GetAutomationRules(boards[0].ID)
	require.NoError(t, err)
	require.Empty(t, rules)

	err = s.DeleteAutomationRule(saved.ID)
	require.Error(t, err, "deleting an already-deleted rule should error")
}

func testAutomationRuns(t *testing.T, s store.Store) {
	users := createTestUsers(t, s, 1)
	boards := createTestBoards(t, s, utils.NewID(utils.IDTypeTeam), users[0].ID, 1)
	cards := createTestCards(t, s, users[0].ID, boards[0].ID, 1)

	rule, err := s.UpsertAutomationRule(&model.AutomationRule{
		BoardID:       boards[0].ID,
		Name:          "rule",
		TriggerType:   model.TriggerCardCreated,
		TriggerConfig: map[string]interface{}{},
		Actions:       []model.AutomationAction{{Type: model.ActionAddComment, Config: map[string]interface{}{"message": "hi"}}},
		CreatedBy:     users[0].ID,
	})
	require.NoError(t, err)

	for i := 0; i < 3; i++ {
		_, err := s.CreateAutomationRun(&model.AutomationRun{
			RuleID: rule.ID,
			CardID: cards[0].ID,
			Status: model.RunStatusSuccess,
		})
		require.NoError(t, err)
	}
	_, err = s.CreateAutomationRun(&model.AutomationRun{
		RuleID: rule.ID,
		CardID: cards[0].ID,
		Status: model.RunStatusError,
		Error:  "boom",
	})
	require.NoError(t, err)

	runs, err := s.GetAutomationRuns(rule.ID, model.QueryAutomationRunOptions{})
	require.NoError(t, err)
	require.Len(t, runs, 4)
	require.Equal(t, model.RunStatusError, runs[0].Status, "most recent run should be first")
	require.Equal(t, "boom", runs[0].Error)

	limited, err := s.GetAutomationRuns(rule.ID, model.QueryAutomationRunOptions{Limit: 2})
	require.NoError(t, err)
	require.Len(t, limited, 2)
}
