// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package automation

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRateLimiterAllow(t *testing.T) {
	r := newRateLimiter()

	for i := 0; i < rateLimitMax; i++ {
		require.True(t, r.Allow("rule1", "card1"), "hit %d should be allowed", i)
	}
	require.False(t, r.Allow("rule1", "card1"), "hit beyond the max should be blocked")

	t.Run("different card is independent", func(t *testing.T) {
		require.True(t, r.Allow("rule1", "card2"))
	})

	t.Run("different rule is independent", func(t *testing.T) {
		require.True(t, r.Allow("rule2", "card1"))
	})
}
