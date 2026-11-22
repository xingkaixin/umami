package cli

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"math"
	"sort"
	"strings"
	"sync"
	"text/tabwriter"
	"time"

	"github.com/xingkaixin/umami/cli/internal/client"
	"github.com/xingkaixin/umami/cli/internal/config"
	"github.com/xingkaixin/umami/cli/internal/timeutil"
)

type globalOptions struct {
	URL      string
	Token    string
	Timezone string
	JSON     bool
}

type filterFlags map[string]string

func (f *filterFlags) String() string { return "" }

func (f *filterFlags) Set(v string) error {
	k, val, ok := strings.Cut(v, "=")
	k = strings.TrimSpace(k)
	if !ok || k == "" {
		return fmt.Errorf("filter must be key=value, got %q", v)
	}
	if *f == nil {
		*f = make(map[string]string)
	}
	(*f)[k] = val
	return nil
}

func Run(ctx context.Context, args []string, stdin io.Reader, stdout, stderr io.Writer, version string) int {
	if err := run(ctx, args, stdin, stdout, stderr, version); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return 0
		}
		fmt.Fprintf(stderr, "error: %v\n", err)
		return 1
	}
	return 0
}

func run(ctx context.Context, args []string, stdin io.Reader, stdout, stderr io.Writer, version string) error {
	var opts globalOptions
	fs := flag.NewFlagSet("umami", flag.ContinueOnError)
	fs.SetOutput(stderr)
	bindGlobalFlags(fs, &opts)
	fs.Usage = func() { printRootUsage(stderr) }

	if err := fs.Parse(args); err != nil {
		return err
	}

	rest := fs.Args()
	if len(rest) == 0 {
		printRootUsage(stdout)
		return nil
	}

	cmd, cmdArgs := rest[0], rest[1:]
	switch cmd {
	case "version", "-v", "--version":
		fmt.Fprintln(stdout, version)
		return nil
	case "help", "-h", "--help":
		printRootUsage(stdout)
		return nil
	case "auth":
		return runAuth(ctx, opts, cmdArgs, stdin, stdout, stderr)
	case "websites", "sites":
		return runWebsites(ctx, opts, cmdArgs, stdout, stderr)
	case "summary":
		return runSummary(ctx, opts, cmdArgs, stdout, stderr)
	case "stats":
		return runStats(ctx, opts, cmdArgs, stdout, stderr)
	case "trend", "pageviews":
		return runTrend(ctx, opts, cmdArgs, stdout, stderr)
	case "metrics":
		return runMetrics(ctx, opts, cmdArgs, stdout, stderr)
	case "active":
		return runActive(ctx, opts, cmdArgs, stdout, stderr)
	case "realtime":
		return runRealtime(ctx, opts, cmdArgs, stdout, stderr)
	case "events":
		return runEvents(ctx, opts, cmdArgs, stdout, stderr)
	default:
		return fmt.Errorf("unknown command %q (run `umami --help`)", cmd)
	}
}

func bindGlobalFlags(fs *flag.FlagSet, opts *globalOptions) {
	fs.StringVar(&opts.URL, "url", opts.URL, "Umami base URL (or UMAMI_URL)")
	fs.StringVar(&opts.Token, "token", opts.Token, "Umami API token (or UMAMI_TOKEN)")
	fs.StringVar(&opts.Timezone, "timezone", opts.Timezone, "IANA timezone (or UMAMI_TIMEZONE)")
	fs.StringVar(&opts.Timezone, "tz", opts.Timezone, "Alias for --timezone")
	fs.BoolVar(&opts.JSON, "json", opts.JSON, "Output JSON")
}

// parseFlexible allows flags both before and after positional arguments so
// `umami summary example.com --range 30d --json` works naturally.
func parseFlexible(fs *flag.FlagSet, args []string) ([]string, error) {
	var positionals []string
	for len(args) > 0 {
		if err := fs.Parse(args); err != nil {
			return nil, err
		}
		remaining := fs.Args()
		if len(remaining) == 0 {
			break
		}
		if remaining[0] == "--" {
			positionals = append(positionals, remaining[1:]...)
			break
		}
		positionals = append(positionals, remaining[0])
		args = remaining[1:]
	}
	return positionals, nil
}

func newClient(opts globalOptions) (*client.Client, config.Config, error) {
	cfg, _, err := config.Resolve(opts.URL, opts.Token, opts.Timezone)
	if err != nil {
		return nil, cfg, err
	}
	return client.New(cfg.URL, cfg.Token), cfg, nil
}

func runAuth(ctx context.Context, opts globalOptions, args []string, stdin io.Reader, stdout, stderr io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: umami auth <login|status|logout>")
	}

	switch args[0] {
	case "login":
		fs := flag.NewFlagSet("umami auth login", flag.ContinueOnError)
		fs.SetOutput(stderr)
		bindGlobalFlags(fs, &opts)
		var noVerify bool
		fs.BoolVar(&noVerify, "no-verify", false, "Save credentials without verifying against the server")
		if _, err := parseFlexible(fs, args[1:]); err != nil {
			return err
		}

		cfg, _, err := config.Resolve(opts.URL, opts.Token, opts.Timezone)
		if err != nil {
			return err
		}
		if cfg.URL == "" {
			return fmt.Errorf("--url is required (e.g. https://umami.example.com)")
		}
		if cfg.Token == "" {
			line, err := readTokenFromStdin(stdin)
			if err != nil {
				return err
			}
			cfg.Token = line
		}
		if cfg.Token == "" {
			return fmt.Errorf("--token is required (or pass via UMAMI_TOKEN / stdin)")
		}

		var user client.VerifyResponse
		if !noVerify {
			user, err = client.New(cfg.URL, cfg.Token).Verify(ctx)
			if err != nil {
				return fmt.Errorf("verify token failed: %w", err)
			}
		}

		path, err := config.Save(cfg)
		if err != nil {
			return err
		}
		if opts.JSON {
			return writeJSON(stdout, map[string]any{
				"configPath": path,
				"url":        cfg.URL,
				"token":      config.MaskToken(cfg.Token),
				"timezone":   cfg.Timezone,
				"user":       user,
			})
		}
		if noVerify {
			fmt.Fprintf(stdout, "Saved config to %s (%s)\n", path, cfg.URL)
		} else {
			fmt.Fprintf(stdout, "Authenticated as %s (%s) on %s\nSaved config to %s\n", user.Username, user.Role, cfg.URL, path)
		}
		return nil

	case "status":
		fs := flag.NewFlagSet("umami auth status", flag.ContinueOnError)
		fs.SetOutput(stderr)
		bindGlobalFlags(fs, &opts)
		if _, err := parseFlexible(fs, args[1:]); err != nil {
			return err
		}

		cfg, path, err := config.Resolve(opts.URL, opts.Token, opts.Timezone)
		if err != nil {
			return err
		}
		status := map[string]any{
			"configPath": path,
			"url":        cfg.URL,
			"token":      config.MaskToken(cfg.Token),
			"timezone":   cfg.Timezone,
			"configured": cfg.URL != "" && cfg.Token != "",
		}
		var user client.VerifyResponse
		var verifyErr error
		if cfg.URL != "" && cfg.Token != "" {
			user, verifyErr = client.New(cfg.URL, cfg.Token).Verify(ctx)
			if verifyErr == nil {
				status["authenticated"] = true
				status["user"] = user
			} else {
				status["authenticated"] = false
				status["error"] = verifyErr.Error()
			}
		}
		if opts.JSON {
			return writeJSON(stdout, status)
		}
		fmt.Fprintf(stdout, "Config:   %s\nURL:      %s\nToken:    %s\n", path, emptyDash(cfg.URL), emptyDash(config.MaskToken(cfg.Token)))
		if cfg.Timezone != "" {
			fmt.Fprintf(stdout, "Timezone: %s\n", cfg.Timezone)
		}
		if cfg.URL == "" || cfg.Token == "" {
			fmt.Fprintln(stdout, "Status:   not configured")
			return nil
		}
		if verifyErr != nil {
			return verifyErr
		}
		fmt.Fprintf(stdout, "User:     %s (%s)\n", user.Username, user.Role)
		return nil

	case "logout":
		path, err := config.Remove()
		if err != nil {
			return err
		}
		if opts.JSON {
			return writeJSON(stdout, map[string]any{"removed": path})
		}
		fmt.Fprintf(stdout, "Removed %s\n", path)
		return nil

	default:
		return fmt.Errorf("unknown auth subcommand %q (expected login, status, logout)", args[0])
	}
}

func readTokenFromStdin(stdin io.Reader) (string, error) {
	if stdin == nil {
		return "", nil
	}
	scanner := bufio.NewScanner(stdin)
	if scanner.Scan() {
		return strings.TrimSpace(scanner.Text()), nil
	}
	return "", scanner.Err()
}

func runWebsites(ctx context.Context, opts globalOptions, args []string, stdout, stderr io.Writer) error {
	fs := flag.NewFlagSet("umami websites", flag.ContinueOnError)
	fs.SetOutput(stderr)
	bindGlobalFlags(fs, &opts)
	var search string
	includeTeams := true
	fs.StringVar(&search, "search", "", "Filter websites by name or domain")
	fs.BoolVar(&includeTeams, "include-teams", true, "Include team websites")
	if _, err := parseFlexible(fs, args); err != nil {
		return err
	}

	c, _, err := newClient(opts)
	if err != nil {
		return err
	}
	sites, err := c.ListWebsites(ctx, includeTeams, search)
	if err != nil {
		return err
	}
	if opts.JSON {
		return writeJSON(stdout, sites)
	}
	if len(sites) == 0 {
		fmt.Fprintln(stdout, "No websites found.")
		return nil
	}
	tw := tabwriter.NewWriter(stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(tw, "NAME\tDOMAIN\tID")
	for _, s := range sites {
		fmt.Fprintf(tw, "%s\t%s\t%s\n", s.Name, s.Domain, s.ID)
	}
	return tw.Flush()
}

type summaryReport struct {
	Website   client.Website     `json:"website"`
	Window    timeutil.Window    `json:"window"`
	Active    int                `json:"activeVisitors"`
	Stats     client.WebsiteStats `json:"stats"`
	TopPages  []client.MetricRow `json:"topPages"`
	Referrers []client.MetricRow `json:"topReferrers"`
	Countries []client.MetricRow `json:"topCountries"`
	Devices   []client.MetricRow `json:"devices"`
}

func runSummary(ctx context.Context, opts globalOptions, args []string, stdout, stderr io.Writer) error {
	fs := flag.NewFlagSet("umami summary", flag.ContinueOnError)
	fs.SetOutput(stderr)
	bindGlobalFlags(fs, &opts)
	var rangeSpec, fromStr, toStr string
	var limit int
	var filters filterFlags
	fs.StringVar(&rangeSpec, "range", "7d", "Time range (24h, 7d, 30d, 90d, today, yesterday, this-week, this-month)")
	fs.StringVar(&fromStr, "from", "", "Start date (YYYY-MM-DD or RFC3339)")
	fs.StringVar(&toStr, "to", "", "End date (YYYY-MM-DD or RFC3339)")
	fs.IntVar(&limit, "limit", 10, "Top rows per breakdown")
	fs.Var(&filters, "filter", "Filter as key=value (repeatable)")
	pos, err := parseFlexible(fs, args)
	if err != nil {
		return err
	}
	if len(pos) == 0 {
		return fmt.Errorf("usage: umami summary <site-id|domain|name> [--range 7d] [--json]")
	}

	c, cfg, err := newClient(opts)
	if err != nil {
		return err
	}
	win, err := timeutil.Resolve(rangeSpec, fromStr, toStr, "", cfg.Timezone, time.Now())
	if err != nil {
		return err
	}
	site, err := c.ResolveWebsite(ctx, pos[0])
	if err != nil {
		return err
	}
	qp := client.QueryParams{
		StartAt:  win.StartAt,
		EndAt:    win.EndAt,
		Unit:     win.Unit,
		Timezone: win.Timezone,
		Filters:  filters,
	}

	var (
		report summaryReport
		wg     sync.WaitGroup
		mu     sync.Mutex
		first  error
	)
	report.Website = site
	report.Window = win

	recordErr := func(err error) {
		if err == nil {
			return
		}
		mu.Lock()
		if first == nil {
			first = err
		}
		mu.Unlock()
	}

	wg.Add(6)
	go func() {
		defer wg.Done()
		v, err := c.GetStats(ctx, site.ID, qp)
		if err != nil {
			recordErr(err)
			return
		}
		mu.Lock()
		report.Stats = v
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		v, err := c.GetActive(ctx, site.ID)
		if err != nil {
			recordErr(err)
			return
		}
		mu.Lock()
		report.Active = v.Visitors
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		v, err := c.GetMetrics(ctx, site.ID, "path", limit, qp)
		if err != nil {
			recordErr(err)
			return
		}
		mu.Lock()
		report.TopPages = v
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		v, err := c.GetMetrics(ctx, site.ID, "referrer", limit, qp)
		if err != nil {
			recordErr(err)
			return
		}
		mu.Lock()
		report.Referrers = v
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		v, err := c.GetMetrics(ctx, site.ID, "country", limit, qp)
		if err != nil {
			recordErr(err)
			return
		}
		mu.Lock()
		report.Countries = v
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		v, err := c.GetMetrics(ctx, site.ID, "device", limit, qp)
		if err != nil {
			recordErr(err)
			return
		}
		mu.Lock()
		report.Devices = v
		mu.Unlock()
	}()
	wg.Wait()
	if first != nil {
		return first
	}

	if opts.JSON {
		return writeJSON(stdout, report)
	}

	fmt.Fprintf(stdout, "%s (%s) | range: %s | tz: %s | active now: %d\n\n",
		site.Name, site.Domain, win.Label, win.Timezone, report.Active)
	writeStatsTable(stdout, report.Stats)
	writeMetricSection(stdout, "Top Pages", report.TopPages)
	writeMetricSection(stdout, "Top Referrers", report.Referrers)
	writeMetricSection(stdout, "Top Countries", report.Countries)
	writeMetricSection(stdout, "Devices", report.Devices)
	return nil
}

func runStats(ctx context.Context, opts globalOptions, args []string, stdout, stderr io.Writer) error {
	fs := flag.NewFlagSet("umami stats", flag.ContinueOnError)
	fs.SetOutput(stderr)
	bindGlobalFlags(fs, &opts)
	var rangeSpec, fromStr, toStr string
	var filters filterFlags
	fs.StringVar(&rangeSpec, "range", "7d", "Time range")
	fs.StringVar(&fromStr, "from", "", "Start date")
	fs.StringVar(&toStr, "to", "", "End date")
	fs.Var(&filters, "filter", "Filter as key=value (repeatable)")
	pos, err := parseFlexible(fs, args)
	if err != nil {
		return err
	}
	if len(pos) == 0 {
		return fmt.Errorf("usage: umami stats <site> [--range 7d] [--json]")
	}

	c, cfg, err := newClient(opts)
	if err != nil {
		return err
	}
	win, err := timeutil.Resolve(rangeSpec, fromStr, toStr, "", cfg.Timezone, time.Now())
	if err != nil {
		return err
	}
	site, err := c.ResolveWebsite(ctx, pos[0])
	if err != nil {
		return err
	}
	stats, err := c.GetStats(ctx, site.ID, client.QueryParams{
		StartAt:  win.StartAt,
		EndAt:    win.EndAt,
		Unit:     win.Unit,
		Timezone: win.Timezone,
		Filters:  filters,
	})
	if err != nil {
		return err
	}
	if opts.JSON {
		return writeJSON(stdout, map[string]any{"website": site, "window": win, "stats": stats})
	}
	fmt.Fprintf(stdout, "%s (%s) | range: %s | tz: %s\n\n", site.Name, site.Domain, win.Label, win.Timezone)
	writeStatsTable(stdout, stats)
	return nil
}

func runTrend(ctx context.Context, opts globalOptions, args []string, stdout, stderr io.Writer) error {
	fs := flag.NewFlagSet("umami trend", flag.ContinueOnError)
	fs.SetOutput(stderr)
	bindGlobalFlags(fs, &opts)
	var rangeSpec, fromStr, toStr, unit string
	var filters filterFlags
	fs.StringVar(&rangeSpec, "range", "7d", "Time range")
	fs.StringVar(&fromStr, "from", "", "Start date")
	fs.StringVar(&toStr, "to", "", "End date")
	fs.StringVar(&unit, "unit", "", "Bucket unit (minute, hour, day, month, year)")
	fs.Var(&filters, "filter", "Filter as key=value (repeatable)")
	pos, err := parseFlexible(fs, args)
	if err != nil {
		return err
	}
	if len(pos) == 0 {
		return fmt.Errorf("usage: umami trend <site> [--range 7d] [--unit day] [--json]")
	}

	c, cfg, err := newClient(opts)
	if err != nil {
		return err
	}
	win, err := timeutil.Resolve(rangeSpec, fromStr, toStr, unit, cfg.Timezone, time.Now())
	if err != nil {
		return err
	}
	site, err := c.ResolveWebsite(ctx, pos[0])
	if err != nil {
		return err
	}
	pv, err := c.GetPageviews(ctx, site.ID, client.QueryParams{
		StartAt:  win.StartAt,
		EndAt:    win.EndAt,
		Unit:     win.Unit,
		Timezone: win.Timezone,
		Filters:  filters,
	})
	if err != nil {
		return err
	}
	if opts.JSON {
		return writeJSON(stdout, map[string]any{"website": site, "window": win, "pageviews": pv.Pageviews, "sessions": pv.Sessions})
	}

	sessionsByTime := make(map[string]float64, len(pv.Sessions))
	for _, s := range pv.Sessions {
		sessionsByTime[s.X] = s.Y
	}
	seen := make(map[string]bool, len(pv.Pageviews))
	var buckets []string
	pvByTime := make(map[string]float64, len(pv.Pageviews))
	for _, p := range pv.Pageviews {
		pvByTime[p.X] = p.Y
		if !seen[p.X] {
			seen[p.X] = true
			buckets = append(buckets, p.X)
		}
	}
	for _, s := range pv.Sessions {
		if !seen[s.X] {
			seen[s.X] = true
			buckets = append(buckets, s.X)
		}
	}
	sort.Strings(buckets)

	fmt.Fprintf(stdout, "%s (%s) | range: %s | unit: %s | tz: %s\n\n", site.Name, site.Domain, win.Label, win.Unit, win.Timezone)
	if len(buckets) == 0 {
		fmt.Fprintln(stdout, "No data.")
		return nil
	}
	tw := tabwriter.NewWriter(stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(tw, "TIME\tPAGEVIEWS\tSESSIONS")
	for _, b := range buckets {
		fmt.Fprintf(tw, "%s\t%.0f\t%.0f\n", b, pvByTime[b], sessionsByTime[b])
	}
	return tw.Flush()
}

func runMetrics(ctx context.Context, opts globalOptions, args []string, stdout, stderr io.Writer) error {
	fs := flag.NewFlagSet("umami metrics", flag.ContinueOnError)
	fs.SetOutput(stderr)
	bindGlobalFlags(fs, &opts)
	var rangeSpec, fromStr, toStr, metricType string
	var limit int
	var expanded bool
	var filters filterFlags
	fs.StringVar(&metricType, "type", "path", "Metric dimension (path, referrer, country, city, browser, os, device, event, channel, entry, exit, title, query, utmSource, utmMedium, utmCampaign)")
	fs.IntVar(&limit, "limit", 20, "Maximum rows")
	fs.BoolVar(&expanded, "expanded", false, "Include pageviews, visits, bounces, and time")
	fs.StringVar(&rangeSpec, "range", "7d", "Time range")
	fs.StringVar(&fromStr, "from", "", "Start date")
	fs.StringVar(&toStr, "to", "", "End date")
	fs.Var(&filters, "filter", "Filter as key=value (repeatable)")
	pos, err := parseFlexible(fs, args)
	if err != nil {
		return err
	}
	if len(pos) == 0 {
		return fmt.Errorf("usage: umami metrics <site> [--type path] [--limit 20] [--expanded] [--json]")
	}

	c, cfg, err := newClient(opts)
	if err != nil {
		return err
	}
	win, err := timeutil.Resolve(rangeSpec, fromStr, toStr, "", cfg.Timezone, time.Now())
	if err != nil {
		return err
	}
	site, err := c.ResolveWebsite(ctx, pos[0])
	if err != nil {
		return err
	}
	qp := client.QueryParams{
		StartAt:  win.StartAt,
		EndAt:    win.EndAt,
		Unit:     win.Unit,
		Timezone: win.Timezone,
		Filters:  filters,
	}

	if expanded {
		rows, err := c.GetExpandedMetrics(ctx, site.ID, metricType, limit, qp)
		if err != nil {
			return err
		}
		if opts.JSON {
			return writeJSON(stdout, map[string]any{"website": site, "window": win, "type": metricType, "data": rows})
		}
		fmt.Fprintf(stdout, "%s (%s) | %s | range: %s\n\n", site.Name, site.Domain, metricType, win.Label)
		if len(rows) == 0 {
			fmt.Fprintln(stdout, "No data.")
			return nil
		}
		tw := tabwriter.NewWriter(stdout, 0, 2, 2, ' ', 0)
		fmt.Fprintln(tw, "VALUE\tVISITORS\tPAGEVIEWS\tVISITS\tBOUNCE\tAVG TIME")
		for _, r := range rows {
			fmt.Fprintf(tw, "%s\t%.0f\t%.0f\t%.0f\t%s\t%s\n",
				r.Name, r.Visitors, r.Pageviews, r.Visits, formatRate(r.Bounces, r.Visits), formatDuration(avgSeconds(r.Totaltime, r.Visits)))
		}
		return tw.Flush()
	}

	rows, err := c.GetMetrics(ctx, site.ID, metricType, limit, qp)
	if err != nil {
		return err
	}
	if opts.JSON {
		return writeJSON(stdout, map[string]any{"website": site, "window": win, "type": metricType, "data": rows})
	}
	fmt.Fprintf(stdout, "%s (%s) | %s | range: %s\n\n", site.Name, site.Domain, metricType, win.Label)
	if len(rows) == 0 {
		fmt.Fprintln(stdout, "No data.")
		return nil
	}
	tw := tabwriter.NewWriter(stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(tw, "VALUE\tCOUNT")
	for _, r := range rows {
		fmt.Fprintf(tw, "%s\t%.0f\n", r.X, r.Y)
	}
	return tw.Flush()
}

func runActive(ctx context.Context, opts globalOptions, args []string, stdout, stderr io.Writer) error {
	fs := flag.NewFlagSet("umami active", flag.ContinueOnError)
	fs.SetOutput(stderr)
	bindGlobalFlags(fs, &opts)
	pos, err := parseFlexible(fs, args)
	if err != nil {
		return err
	}
	if len(pos) == 0 {
		return fmt.Errorf("usage: umami active <site> [--json]")
	}

	c, _, err := newClient(opts)
	if err != nil {
		return err
	}
	site, err := c.ResolveWebsite(ctx, pos[0])
	if err != nil {
		return err
	}
	active, err := c.GetActive(ctx, site.ID)
	if err != nil {
		return err
	}
	if opts.JSON {
		return writeJSON(stdout, map[string]any{"website": site, "visitors": active.Visitors})
	}
	fmt.Fprintf(stdout, "%s (%s): %d active visitors\n", site.Name, site.Domain, active.Visitors)
	return nil
}

func runRealtime(ctx context.Context, opts globalOptions, args []string, stdout, stderr io.Writer) error {
	fs := flag.NewFlagSet("umami realtime", flag.ContinueOnError)
	fs.SetOutput(stderr)
	bindGlobalFlags(fs, &opts)
	pos, err := parseFlexible(fs, args)
	if err != nil {
		return err
	}
	if len(pos) == 0 {
		return fmt.Errorf("usage: umami realtime <site> [--json]")
	}

	c, cfg, err := newClient(opts)
	if err != nil {
		return err
	}
	tz := cfg.Timezone
	if tz == "" {
		tz = timeutil.DefaultTimezone()
	}
	site, err := c.ResolveWebsite(ctx, pos[0])
	if err != nil {
		return err
	}
	rt, err := c.GetRealtime(ctx, site.ID, tz)
	if err != nil {
		return err
	}
	if opts.JSON {
		return writeJSON(stdout, map[string]any{"website": site, "realtime": rt})
	}
	fmt.Fprintf(stdout, "%s (%s) | last 30m\n", site.Name, site.Domain)
	fmt.Fprintf(stdout, "Views: %d  Visitors: %d  Events: %d  Countries: %d\n",
		rt.Totals.Views, rt.Totals.Visitors, rt.Totals.Events, rt.Totals.Countries)
	writeMetricSection(stdout, "Top URLs", mapToMetrics(rt.URLs, 10))
	writeMetricSection(stdout, "Top Referrers", mapToMetrics(rt.Referrers, 10))
	writeMetricSection(stdout, "Top Countries", mapToMetrics(rt.Countries, 10))
	return nil
}

func runEvents(ctx context.Context, opts globalOptions, args []string, stdout, stderr io.Writer) error {
	fs := flag.NewFlagSet("umami events", flag.ContinueOnError)
	fs.SetOutput(stderr)
	bindGlobalFlags(fs, &opts)
	var rangeSpec, fromStr, toStr, search string
	var page, limit int
	var filters filterFlags
	fs.StringVar(&rangeSpec, "range", "7d", "Time range")
	fs.StringVar(&fromStr, "from", "", "Start date")
	fs.StringVar(&toStr, "to", "", "End date")
	fs.StringVar(&search, "search", "", "Search event name or URL path")
	fs.IntVar(&page, "page", 1, "Page number")
	fs.IntVar(&limit, "limit", 20, "Page size")
	fs.Var(&filters, "filter", "Filter as key=value (repeatable)")
	pos, err := parseFlexible(fs, args)
	if err != nil {
		return err
	}
	if len(pos) == 0 {
		return fmt.Errorf("usage: umami events <site> [--range 7d] [--limit 20] [--json]")
	}

	c, cfg, err := newClient(opts)
	if err != nil {
		return err
	}
	win, err := timeutil.Resolve(rangeSpec, fromStr, toStr, "", cfg.Timezone, time.Now())
	if err != nil {
		return err
	}
	site, err := c.ResolveWebsite(ctx, pos[0])
	if err != nil {
		return err
	}
	resp, err := c.GetEvents(ctx, site.ID, page, limit, search, client.QueryParams{
		StartAt:  win.StartAt,
		EndAt:    win.EndAt,
		Unit:     win.Unit,
		Timezone: win.Timezone,
		Filters:  filters,
	})
	if err != nil {
		return err
	}
	if opts.JSON {
		return writeJSON(stdout, map[string]any{"website": site, "window": win, "events": resp})
	}
	fmt.Fprintf(stdout, "%s (%s) | range: %s | total: %d (page %d)\n\n", site.Name, site.Domain, win.Label, resp.Count, resp.Page)
	if len(resp.Data) == 0 {
		fmt.Fprintln(stdout, "No events found.")
		return nil
	}
	tw := tabwriter.NewWriter(stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(tw, "TIME\tTYPE\tPATH/EVENT\tREFERRER\tCOUNTRY\tDEVICE")
	for _, ev := range resp.Data {
		kind := "pageview"
		target := ev.URLPath
		if ev.EventType == 2 {
			kind = "event"
			if ev.EventName != "" {
				target = ev.EventName
			}
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\t%s\n",
			ev.CreatedAt, kind, target, emptyDash(ev.ReferrerDomain), emptyDash(ev.Country), emptyDash(ev.Device))
	}
	return tw.Flush()
}

func writeStatsTable(w io.Writer, s client.WebsiteStats) {
	tw := tabwriter.NewWriter(w, 0, 2, 2, ' ', 0)
	fmt.Fprintln(tw, "METRIC\tCURRENT\tPREVIOUS\tCHANGE")
	fmt.Fprintf(tw, "Pageviews\t%.0f\t%.0f\t%s\n", s.Pageviews, s.Comparison.Pageviews, formatDelta(s.Pageviews, s.Comparison.Pageviews))
	fmt.Fprintf(tw, "Visitors\t%.0f\t%.0f\t%s\n", s.Visitors, s.Comparison.Visitors, formatDelta(s.Visitors, s.Comparison.Visitors))
	fmt.Fprintf(tw, "Visits\t%.0f\t%.0f\t%s\n", s.Visits, s.Comparison.Visits, formatDelta(s.Visits, s.Comparison.Visits))
	fmt.Fprintf(tw, "Bounce Rate\t%s\t%s\t%s\n",
		formatRate(s.Bounces, s.Visits),
		formatRate(s.Comparison.Bounces, s.Comparison.Visits),
		formatRateDelta(s.Bounces, s.Visits, s.Comparison.Bounces, s.Comparison.Visits),
	)
	fmt.Fprintf(tw, "Avg Visit Time\t%s\t%s\t%s\n",
		formatDuration(avgSeconds(s.Totaltime, s.Visits)),
		formatDuration(avgSeconds(s.Comparison.Totaltime, s.Comparison.Visits)),
		formatDelta(avgSeconds(s.Totaltime, s.Visits), avgSeconds(s.Comparison.Totaltime, s.Comparison.Visits)),
	)
	_ = tw.Flush()
}

func writeMetricSection(w io.Writer, title string, rows []client.MetricRow) {
	if len(rows) == 0 {
		return
	}
	fmt.Fprintf(w, "\n%s:\n", title)
	tw := tabwriter.NewWriter(w, 0, 2, 2, ' ', 0)
	for _, r := range rows {
		fmt.Fprintf(tw, "  %s\t%.0f\n", r.X, r.Y)
	}
	_ = tw.Flush()
}

func mapToMetrics(m map[string]int, limit int) []client.MetricRow {
	rows := make([]client.MetricRow, 0, len(m))
	for k, v := range m {
		if k == "" {
			continue
		}
		rows = append(rows, client.MetricRow{X: k, Y: float64(v)})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Y != rows[j].Y {
			return rows[i].Y > rows[j].Y
		}
		return rows[i].X < rows[j].X
	})
	if limit > 0 && len(rows) > limit {
		rows = rows[:limit]
	}
	return rows
}

func formatDelta(cur, prev float64) string {
	if prev == 0 {
		if cur == 0 {
			return "0.0%"
		}
		return "n/a"
	}
	pct := ((cur - prev) / prev) * 100
	return fmt.Sprintf("%+.1f%%", pct)
}

func formatRate(num, den float64) string {
	if den <= 0 {
		return "0.0%"
	}
	return fmt.Sprintf("%.1f%%", math.Min(num, den)/den*100)
}

func formatRateDelta(curNum, curDen, prevNum, prevDen float64) string {
	if curDen <= 0 || prevDen <= 0 {
		return "n/a"
	}
	cur := math.Min(curNum, curDen) / curDen * 100
	prev := math.Min(prevNum, prevDen) / prevDen * 100
	return fmt.Sprintf("%+.1fpp", cur-prev)
}

func avgSeconds(total, visits float64) float64 {
	if visits <= 0 {
		return 0
	}
	return total / visits
}

func formatDuration(seconds float64) string {
	s := int(math.Round(seconds))
	if s < 0 {
		s = 0
	}
	if s < 60 {
		return fmt.Sprintf("%ds", s)
	}
	m := s / 60
	rem := s % 60
	if m < 60 {
		return fmt.Sprintf("%dm%02ds", m, rem)
	}
	return fmt.Sprintf("%dh%02dm", m/60, m%60)
}

func emptyDash(v string) string {
	if strings.TrimSpace(v) == "" {
		return "-"
	}
	return v
}

func writeJSON(w io.Writer, v any) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

func printRootUsage(w io.Writer) {
	fmt.Fprint(w, `umami - read-only CLI for Umami analytics

Usage:
  umami <command> [arguments] [flags]

Commands:
  auth login      Save and verify Umami URL and API token
  auth status     Show current configuration and authenticated user
  auth logout     Remove saved configuration
  websites        List accessible websites
  summary <site>  Overview stats, active visitors, and top breakdowns
  stats <site>    Key traffic metrics with period comparison
  trend <site>    Pageviews and sessions time series
  metrics <site>  Breakdown by dimension (--type path|referrer|country|device|browser|os|event|...)
  active <site>   Current active visitor count
  realtime <site> Last 30 minutes realtime snapshot
  events <site>   Recent pageviews and custom events

Site matching:
  <site> accepts a website ID, domain, name, or unique partial match.

Global flags:
  --url <url>          Umami base URL (or UMAMI_URL)
  --token <token>      Umami API token (or UMAMI_TOKEN)
  --timezone, --tz     IANA timezone (or UMAMI_TIMEZONE)
  --json               Output machine-readable JSON
`)
}
