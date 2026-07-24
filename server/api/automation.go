// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/audit"
)

func (a *API) registerAutomationRoutes(r *mux.Router) {
	r.HandleFunc("/boards/{boardID}/automation/rules", a.sessionRequired(a.handleGetAutomationRules)).Methods("GET")
	r.HandleFunc("/boards/{boardID}/automation/rules", a.sessionRequired(a.handleCreateAutomationRule)).Methods("POST")
	r.HandleFunc("/boards/{boardID}/automation/rules/{ruleID}", a.sessionRequired(a.handleUpdateAutomationRule)).Methods("PUT")
	r.HandleFunc("/boards/{boardID}/automation/rules/{ruleID}", a.sessionRequired(a.handleDeleteAutomationRule)).Methods("DELETE")
	r.HandleFunc("/boards/{boardID}/automation/rules/{ruleID}/runs", a.sessionRequired(a.handleGetAutomationRuns)).Methods("GET")
}

func (a *API) handleGetAutomationRules(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /boards/{boardID}/automation/rules getAutomationRules
	//
	// Returns the automation rules defined for a board
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/AutomationRule"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	boardID := mux.Vars(r)["boardID"]
	userID := getUserID(r)

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	rules, err := a.app.GetAutomationRules(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	data, err := json.Marshal(rules)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	jsonBytesResponse(w, http.StatusOK, data)
}

func (a *API) handleCreateAutomationRule(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /boards/{boardID}/automation/rules createAutomationRule
	//
	// Creates a new automation rule for a board
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: automation rule to create
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/AutomationRule"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/AutomationRule"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	boardID := mux.Vars(r)["boardID"]
	userID := getUserID(r)

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardProperties) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	rule, err := model.AutomationRuleFromJSON(r.Body)
	if err != nil {
		a.errorResponse(w, r, model.NewErrBadRequest(err.Error()))
		return
	}
	rule.ID = ""
	rule.BoardID = boardID

	if err := rule.IsValid(); err != nil {
		a.errorResponse(w, r, model.NewErrBadRequest(err.Error()))
		return
	}

	auditRec := a.makeAuditRecord(r, "createAutomationRule", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)

	saved, err := a.app.UpsertAutomationRule(rule, userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	a.automation.InvalidateCache(boardID)

	data, err := json.Marshal(saved)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.AddMeta("ruleID", saved.ID)
	auditRec.Success()
}

func (a *API) handleUpdateAutomationRule(w http.ResponseWriter, r *http.Request) {
	// swagger:operation PUT /boards/{boardID}/automation/rules/{ruleID} updateAutomationRule
	//
	// Updates an existing automation rule
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: ruleID
	//   in: path
	//   description: Rule ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: automation rule fields to update
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/AutomationRule"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/AutomationRule"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	boardID := mux.Vars(r)["boardID"]
	ruleID := mux.Vars(r)["ruleID"]
	userID := getUserID(r)

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardProperties) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	existing, err := a.app.GetAutomationRule(ruleID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	if existing.BoardID != boardID {
		a.errorResponse(w, r, model.NewErrNotFound("automation rule ID="+ruleID))
		return
	}

	rule, err := model.AutomationRuleFromJSON(r.Body)
	if err != nil {
		a.errorResponse(w, r, model.NewErrBadRequest(err.Error()))
		return
	}
	rule.ID = ruleID
	rule.BoardID = boardID
	rule.CreatedBy = existing.CreatedBy

	if err := rule.IsValid(); err != nil {
		a.errorResponse(w, r, model.NewErrBadRequest(err.Error()))
		return
	}

	auditRec := a.makeAuditRecord(r, "updateAutomationRule", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("ruleID", ruleID)

	saved, err := a.app.UpsertAutomationRule(rule, userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	a.automation.InvalidateCache(boardID)

	data, err := json.Marshal(saved)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

func (a *API) handleDeleteAutomationRule(w http.ResponseWriter, r *http.Request) {
	// swagger:operation DELETE /boards/{boardID}/automation/rules/{ruleID} deleteAutomationRule
	//
	// Deletes an automation rule
	//
	// ---
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: ruleID
	//   in: path
	//   description: Rule ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	boardID := mux.Vars(r)["boardID"]
	ruleID := mux.Vars(r)["ruleID"]
	userID := getUserID(r)

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardProperties) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	existing, err := a.app.GetAutomationRule(ruleID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	if existing.BoardID != boardID {
		a.errorResponse(w, r, model.NewErrNotFound("automation rule ID="+ruleID))
		return
	}

	auditRec := a.makeAuditRecord(r, "deleteAutomationRule", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("ruleID", ruleID)

	if err := a.app.DeleteAutomationRule(ruleID); err != nil {
		a.errorResponse(w, r, err)
		return
	}
	a.automation.InvalidateCache(boardID)

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) handleGetAutomationRuns(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /boards/{boardID}/automation/rules/{ruleID}/runs getAutomationRuns
	//
	// Returns the run log for an automation rule, most recent first
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: ruleID
	//   in: path
	//   description: Rule ID
	//   required: true
	//   type: string
	// - name: limit
	//   in: query
	//   description: Maximum number of run entries to return, omit for no limit
	//   required: false
	//   type: integer
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/AutomationRun"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	boardID := mux.Vars(r)["boardID"]
	ruleID := mux.Vars(r)["ruleID"]
	userID := getUserID(r)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	runs, err := a.app.GetAutomationRuns(ruleID, model.QueryAutomationRunOptions{Limit: limit})
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	data, err := json.Marshal(runs)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	jsonBytesResponse(w, http.StatusOK, data)
}
