// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/utils"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

var automationRuleFields = []string{
	"id",
	"board_id",
	"name",
	"enabled",
	"trigger_type",
	"trigger_config",
	"actions",
	"created_by",
	"modified_by",
	"create_at",
	"update_at",
	"delete_at",
}

func (s *SQLStore) automationRulesFromRows(rows *sql.Rows) ([]*model.AutomationRule, error) {
	rules := []*model.AutomationRule{}

	for rows.Next() {
		var rule model.AutomationRule
		var triggerConfigJSON string
		var actionsJSON string

		err := rows.Scan(
			&rule.ID,
			&rule.BoardID,
			&rule.Name,
			&rule.Enabled,
			&rule.TriggerType,
			&triggerConfigJSON,
			&actionsJSON,
			&rule.CreatedBy,
			&rule.ModifiedBy,
			&rule.CreateAt,
			&rule.UpdateAt,
			&rule.DeleteAt,
		)
		if err != nil {
			return nil, err
		}

		if triggerConfigJSON != "" {
			if err := json.Unmarshal([]byte(triggerConfigJSON), &rule.TriggerConfig); err != nil {
				return nil, err
			}
		}
		if actionsJSON != "" {
			if err := json.Unmarshal([]byte(actionsJSON), &rule.Actions); err != nil {
				return nil, err
			}
		}

		rules = append(rules, &rule)
	}
	return rules, nil
}

func (s *SQLStore) getAutomationRules(db sq.BaseRunner, boardID string) ([]*model.AutomationRule, error) {
	query := s.getQueryBuilder(db).
		Select(automationRuleFields...).
		From(s.tablePrefix + "automation_rules").
		Where(sq.Eq{"board_id": boardID}).
		Where(sq.Eq{"delete_at": 0}).
		OrderBy("create_at")

	rows, err := query.Query()
	if err != nil {
		s.logger.Error("Cannot fetch automation rules for board", mlog.String("board_id", boardID), mlog.Err(err))
		return nil, err
	}
	defer s.CloseRows(rows)

	return s.automationRulesFromRows(rows)
}

func (s *SQLStore) getAutomationRule(db sq.BaseRunner, ruleID string) (*model.AutomationRule, error) {
	query := s.getQueryBuilder(db).
		Select(automationRuleFields...).
		From(s.tablePrefix + "automation_rules").
		Where(sq.Eq{"id": ruleID}).
		Where(sq.Eq{"delete_at": 0})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error("Cannot fetch automation rule", mlog.String("rule_id", ruleID), mlog.Err(err))
		return nil, err
	}
	defer s.CloseRows(rows)

	rules, err := s.automationRulesFromRows(rows)
	if err != nil {
		return nil, err
	}
	if len(rules) == 0 {
		return nil, model.NewErrNotFound("automation rule ID=" + ruleID)
	}
	return rules[0], nil
}

// upsertAutomationRule creates a new rule (if rule.ID is unknown) or updates an existing one,
// preserving the original CreatedBy/CreateAt on update.
func (s *SQLStore) upsertAutomationRule(db sq.BaseRunner, rule *model.AutomationRule) (*model.AutomationRule, error) {
	if err := rule.IsValid(); err != nil {
		return nil, err
	}

	triggerConfigJSON, err := json.Marshal(rule.TriggerConfig)
	if err != nil {
		return nil, err
	}
	actionsJSON, err := json.Marshal(rule.Actions)
	if err != nil {
		return nil, err
	}

	now := utils.GetMillis()
	existing, err := s.getAutomationRule(db, rule.ID)
	if err != nil && !model.IsErrNotFound(err) {
		return nil, err
	}

	toSave := *rule
	toSave.UpdateAt = now

	if existing == nil {
		if toSave.ID == "" {
			toSave.ID = utils.NewID(utils.IDTypeRule)
		}
		toSave.CreateAt = now

		query := s.getQueryBuilder(db).
			Insert(s.tablePrefix + "automation_rules").
			Columns(automationRuleFields...).
			Values(
				toSave.ID,
				toSave.BoardID,
				toSave.Name,
				toSave.Enabled,
				toSave.TriggerType,
				triggerConfigJSON,
				actionsJSON,
				toSave.CreatedBy,
				toSave.ModifiedBy,
				toSave.CreateAt,
				toSave.UpdateAt,
				toSave.DeleteAt,
			)
		if _, err := query.Exec(); err != nil {
			s.logger.Error("Cannot create automation rule", mlog.String("board_id", toSave.BoardID), mlog.Err(err))
			return nil, err
		}
		return &toSave, nil
	}

	toSave.CreatedBy = existing.CreatedBy
	toSave.CreateAt = existing.CreateAt

	query := s.getQueryBuilder(db).
		Update(s.tablePrefix+"automation_rules").
		Set("name", toSave.Name).
		Set("enabled", toSave.Enabled).
		Set("trigger_type", toSave.TriggerType).
		Set("trigger_config", triggerConfigJSON).
		Set("actions", actionsJSON).
		Set("modified_by", toSave.ModifiedBy).
		Set("update_at", toSave.UpdateAt).
		Where(sq.Eq{"id": toSave.ID})

	if _, err := query.Exec(); err != nil {
		s.logger.Error("Cannot update automation rule", mlog.String("rule_id", toSave.ID), mlog.Err(err))
		return nil, err
	}
	return &toSave, nil
}

func (s *SQLStore) deleteAutomationRule(db sq.BaseRunner, ruleID string) error {
	query := s.getQueryBuilder(db).
		Update(s.tablePrefix+"automation_rules").
		Set("delete_at", utils.GetMillis()).
		Where(sq.Eq{"id": ruleID}).
		Where(sq.Eq{"delete_at": 0})

	result, err := query.Exec()
	if err != nil {
		return err
	}

	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return model.NewErrNotFound("automation rule ID=" + ruleID)
	}
	return nil
}

var automationRunFields = []string{
	"id",
	"rule_id",
	"card_id",
	"status",
	"error",
	"create_at",
}

func (s *SQLStore) createAutomationRun(db sq.BaseRunner, run *model.AutomationRun) (*model.AutomationRun, error) {
	toSave := *run
	if toSave.ID == "" {
		toSave.ID = utils.NewID(utils.IDTypeRuleRun)
	}
	if toSave.CreateAt == 0 {
		toSave.CreateAt = utils.GetMillis()
	}

	query := s.getQueryBuilder(db).
		Insert(s.tablePrefix + "automation_runs").
		Columns(automationRunFields...).
		Values(
			toSave.ID,
			toSave.RuleID,
			toSave.CardID,
			toSave.Status,
			toSave.Error,
			toSave.CreateAt,
		)

	if _, err := query.Exec(); err != nil {
		s.logger.Error("Cannot create automation run", mlog.String("rule_id", toSave.RuleID), mlog.Err(err))
		return nil, err
	}
	return &toSave, nil
}

func (s *SQLStore) getAutomationRuns(db sq.BaseRunner, ruleID string, opts model.QueryAutomationRunOptions) ([]*model.AutomationRun, error) {
	builder := s.getQueryBuilder(db).
		Select(automationRunFields...).
		From(s.tablePrefix + "automation_runs").
		Where(sq.Eq{"rule_id": ruleID}).
		OrderBy("create_at DESC")

	if opts.Limit > 0 {
		builder = builder.Limit(uint64(opts.Limit))
	}

	rows, err := builder.Query()
	if err != nil {
		s.logger.Error("Cannot fetch automation runs for rule", mlog.String("rule_id", ruleID), mlog.Err(err))
		return nil, err
	}
	defer s.CloseRows(rows)

	runs := []*model.AutomationRun{}
	for rows.Next() {
		var run model.AutomationRun
		var errStr sql.NullString
		err := rows.Scan(
			&run.ID,
			&run.RuleID,
			&run.CardID,
			&run.Status,
			&errStr,
			&run.CreateAt,
		)
		if err != nil {
			return nil, err
		}
		run.Error = errStr.String
		runs = append(runs, &run)
	}
	return runs, nil
}
