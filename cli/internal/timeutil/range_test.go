package timeutil

import (
	"testing"
	"time"
)

func TestResolvePresetsAndExplicitRanges(t *testing.T) {
	now := time.Date(2026, 11, 22, 15, 30, 0, 0, time.UTC)

	win24h, err := Resolve("24h", "", "", "", "UTC", now)
	if err != nil {
		t.Fatalf("24h failed: %v", err)
	}
	if win24h.Unit != "hour" {
		t.Fatalf("expected hour unit, got %q", win24h.Unit)
	}
	if win24h.EndAt-win24h.StartAt != int64((24*time.Hour)/time.Millisecond) {
		t.Fatalf("unexpected 24h span: %d", win24h.EndAt-win24h.StartAt)
	}

	win30d, err := Resolve("30d", "", "", "", "Asia/Shanghai", now)
	if err != nil {
		t.Fatalf("30d failed: %v", err)
	}
	if win30d.Unit != "day" || win30d.Timezone != "Asia/Shanghai" {
		t.Fatalf("unexpected 30d window: %+v", win30d)
	}

	winCustom, err := Resolve("", "2026-10-01", "2026-10-07", "", "UTC", now)
	if err != nil {
		t.Fatalf("custom range failed: %v", err)
	}
	if winCustom.Unit != "day" || winCustom.Label != "2026-10-01..2026-10-07" {
		t.Fatalf("unexpected custom window: %+v", winCustom)
	}

	if _, err := Resolve("bad", "", "", "", "UTC", now); err == nil {
		t.Fatal("expected invalid range to fail")
	}
}
