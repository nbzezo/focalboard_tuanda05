// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type AutomationTriggerType string

const (
	TriggerCardCreated         AutomationTriggerType = "card-created"
	TriggerPropertyChanged     AutomationTriggerType = "property-changed"
	TriggerMovedToGroup        AutomationTriggerType = "moved-to-group"
	TriggerChecklistCompleted  AutomationTriggerType = "checklist-completed"
	TriggerDependencyUnblocked AutomationTriggerType = "dependency-unblocked"
)

func (t AutomationTriggerType) IsValid() bool {
	switch t {
	case TriggerCardCreated, TriggerPropertyChanged, TriggerMovedToGroup, TriggerChecklistCompleted, TriggerDependencyUnblocked:
		return true
	}
	return false
}

type AutomationActionType string

const (
	ActionSetProperty AutomationActionType = "set-property"
	ActionMoveToGroup AutomationActionType = "move-to-group"
	ActionAddComment  AutomationActionType = "add-comment"
	ActionNotifyUser  AutomationActionType = "notify-user"
)

func (t AutomationActionType) IsValid() bool {
	switch t {
	case ActionSetProperty, ActionMoveToGroup, ActionAddComment, ActionNotifyUser:
		return true
	}
	return false
}

// AutomationAction is one action a rule performs when its trigger matches.
// Config is a free-form map, shape depends on Type:
//   - set-property / move-to-group: {"propertyId": string, "value": any}
//   - add-comment: {"message": string} (supports {{card.title}} token substitution)
//   - notify-user: {"userId": string, "message": string}
//
// swagger:model
type AutomationAction struct {
	// required: true
	Type AutomationActionType `json:"type"`
	// required: true
	Config map[string]interface{} `json:"config"`
}

// AutomationRule is a user-defined "when X happens on this board, do Y" rule.
// TriggerConfig is a free-form map, shape depends on TriggerType:
//   - property-changed / moved-to-group: {"propertyId": string, "toValue": any (optional)}
//   - checklist-completed: {} (fires whenever a card's checkboxes all become checked)
//   - dependency-unblocked: {"propertyId": string, "doneValue": any} (defines what "done" means on the blocking card)
//   - card-created: {}
//
// swagger:model
type AutomationRule struct {
	// required: true
	ID string `json:"id"`
	// required: true
	BoardID string `json:"boardId"`
	// required: true
	Name string `json:"name"`
	// required: true
	Enabled bool `json:"enabled"`
	// required: true
	TriggerType AutomationTriggerType `json:"triggerType"`
	// required: true
	TriggerConfig map[string]interface{} `json:"triggerConfig"`
	// required: true
	Actions []AutomationAction `json:"actions"`

	CreatedBy  string `json:"createdBy"`
	ModifiedBy string `json:"modifiedBy"`
	CreateAt   int64  `json:"createAt"`
	UpdateAt   int64  `json:"updateAt"`
	DeleteAt   int64  `json:"deleteAt"`
}

func (r *AutomationRule) IsValid() error {
	if r == nil {
		return ErrInvalidAutomationRule{"cannot be nil"}
	}
	if r.BoardID == "" {
		return ErrInvalidAutomationRule{"missing board id"}
	}
	if r.Name == "" {
		return ErrInvalidAutomationRule{"missing name"}
	}
	if !r.TriggerType.IsValid() {
		return ErrInvalidAutomationRule{"invalid trigger type"}
	}
	if len(r.Actions) == 0 {
		return ErrInvalidAutomationRule{"at least one action is required"}
	}
	for _, action := range r.Actions {
		if !action.Type.IsValid() {
			return ErrInvalidAutomationRule{"invalid action type"}
		}
	}
	return nil
}

func AutomationRuleFromJSON(data io.Reader) (*AutomationRule, error) {
	var rule AutomationRule
	if err := json.NewDecoder(data).Decode(&rule); err != nil {
		return nil, err
	}
	return &rule, nil
}

type ErrInvalidAutomationRule struct {
	msg string
}

func (e ErrInvalidAutomationRule) Error() string {
	return e.msg
}

type AutomationRunStatus string

const (
	RunStatusSuccess AutomationRunStatus = "success"
	RunStatusError   AutomationRunStatus = "error"
	RunStatusSkipped AutomationRunStatus = "skipped"
)

// AutomationRun is a log entry recording one execution attempt of a rule against a card.
// swagger:model
type AutomationRun struct {
	// required: true
	ID string `json:"id"`
	// required: true
	RuleID string `json:"ruleId"`
	// required: true
	CardID string `json:"cardId"`
	// required: true
	Status AutomationRunStatus `json:"status"`

	Error    string `json:"error,omitempty"`
	CreateAt int64  `json:"createAt"`
}

// QueryAutomationRunOptions are query options that can be passed to GetAutomationRuns.
type QueryAutomationRunOptions struct {
	Limit int // if non-zero then limit the number of returned records (most recent first)
}
