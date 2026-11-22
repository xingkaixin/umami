package timeutil

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

type Window struct {
	StartAt  int64  `json:"startAt"`
	EndAt    int64  `json:"endAt"`
	Unit     string `json:"unit"`
	Timezone string `json:"timezone"`
	Label    string `json:"range"`
}

func DefaultTimezone() string {
	name := time.Now().Location().String()
	if name == "" || name == "Local" {
		return "UTC"
	}
	return name
}

func Resolve(rangeSpec, fromStr, toStr, unit, tzName string, now time.Time) (Window, error) {
	tz := strings.TrimSpace(tzName)
	if tz == "" {
		tz = DefaultTimezone()
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return Window{}, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}
	nowInLoc := now.In(loc)

	var start, end time.Time
	var label string

	if strings.TrimSpace(fromStr) != "" || strings.TrimSpace(toStr) != "" {
		if strings.TrimSpace(fromStr) == "" {
			return Window{}, fmt.Errorf("--from is required when --to is set")
		}
		start, err = parseBoundary(fromStr, loc, false)
		if err != nil {
			return Window{}, fmt.Errorf("invalid --from %q: %w", fromStr, err)
		}
		if strings.TrimSpace(toStr) == "" {
			end = nowInLoc
		} else {
			end, err = parseBoundary(toStr, loc, true)
			if err != nil {
				return Window{}, fmt.Errorf("invalid --to %q: %w", toStr, err)
			}
		}
		label = fmt.Sprintf("%s..%s", start.Format("2006-01-02"), end.Format("2006-01-02"))
	} else {
		spec := strings.ToLower(strings.TrimSpace(rangeSpec))
		if spec == "" {
			spec = "7d"
		}
		start, end, err = resolvePreset(spec, nowInLoc, loc)
		if err != nil {
			return Window{}, err
		}
		label = spec
	}

	if !end.After(start) {
		return Window{}, fmt.Errorf("end time must be after start time")
	}

	resolvedUnit := strings.TrimSpace(unit)
	if resolvedUnit == "" {
		resolvedUnit = defaultUnit(end.Sub(start))
	} else if !isValidUnit(resolvedUnit) {
		return Window{}, fmt.Errorf("invalid unit %q (expected minute, hour, day, month, year)", resolvedUnit)
	}

	return Window{
		StartAt:  start.UnixMilli(),
		EndAt:    end.UnixMilli(),
		Unit:     resolvedUnit,
		Timezone: tz,
		Label:    label,
	}, nil
}

func resolvePreset(spec string, now time.Time, loc *time.Location) (time.Time, time.Time, error) {
	switch spec {
	case "today":
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
		return start, now, nil
	case "yesterday":
		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
		start := today.AddDate(0, 0, -1)
		end := today.Add(-time.Millisecond)
		return start, end, nil
	case "this-week":
		offset := (int(now.Weekday()) + 6) % 7 // Monday as start of week
		start := time.Date(now.Year(), now.Month(), now.Day()-offset, 0, 0, 0, 0, loc)
		return start, now, nil
	case "this-month":
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
		return start, now, nil
	case "this-year":
		start := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, loc)
		return start, now, nil
	}

	if strings.HasSuffix(spec, "h") {
		n, err := strconv.Atoi(strings.TrimSuffix(spec, "h"))
		if err != nil || n <= 0 {
			return time.Time{}, time.Time{}, fmt.Errorf("invalid range %q", spec)
		}
		return now.Add(-time.Duration(n) * time.Hour), now, nil
	}
	if strings.HasSuffix(spec, "d") {
		n, err := strconv.Atoi(strings.TrimSuffix(spec, "d"))
		if err != nil || n <= 0 {
			return time.Time{}, time.Time{}, fmt.Errorf("invalid range %q", spec)
		}
		return now.AddDate(0, 0, -n), now, nil
	}

	return time.Time{}, time.Time{}, fmt.Errorf("unsupported range %q (examples: 24h, 7d, 30d, 90d, today, yesterday, this-week, this-month)", spec)
}

func parseBoundary(raw string, loc *time.Location, endOfDay bool) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.In(loc), nil
	}
	if t, err := time.ParseInLocation("2006-01-02", raw, loc); err == nil {
		if endOfDay {
			return t.AddDate(0, 0, 1).Add(-time.Millisecond), nil
		}
		return t, nil
	}
	return time.Time{}, fmt.Errorf("expected YYYY-MM-DD or RFC3339 timestamp")
}

func defaultUnit(span time.Duration) string {
	switch {
	case span <= 48*time.Hour:
		return "hour"
	case span <= 90*24*time.Hour:
		return "day"
	default:
		return "month"
	}
}

func isValidUnit(unit string) bool {
	switch unit {
	case "minute", "hour", "day", "month", "year":
		return true
	default:
		return false
	}
}
