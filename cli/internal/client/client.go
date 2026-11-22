package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

type APIError struct {
	Status  int
	Code    string
	Message string
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("API error (%d): %s", e.Status, e.Message)
	}
	return fmt.Sprintf("API error (%d)", e.Status)
}

type VerifyResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	IsAdmin  bool   `json:"isAdmin"`
}

type Website struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Domain string `json:"domain"`
	TeamID string `json:"teamId,omitempty"`
}

type WebsiteList struct {
	Data     []Website `json:"data"`
	Count    int       `json:"count"`
	Page     int       `json:"page"`
	PageSize int       `json:"pageSize"`
}

type StatsValues struct {
	Pageviews float64 `json:"pageviews"`
	Visitors  float64 `json:"visitors"`
	Visits    float64 `json:"visits"`
	Bounces   float64 `json:"bounces"`
	Totaltime float64 `json:"totaltime"`
}

type WebsiteStats struct {
	StatsValues
	Comparison StatsValues `json:"comparison"`
}

type TimePoint struct {
	X string  `json:"x"`
	Y float64 `json:"y"`
}

type PageviewsResponse struct {
	Pageviews []TimePoint `json:"pageviews"`
	Sessions  []TimePoint `json:"sessions"`
}

type MetricRow struct {
	X string  `json:"x"`
	Y float64 `json:"y"`
}

type ExpandedMetricRow struct {
	Name      string  `json:"name"`
	Pageviews float64 `json:"pageviews"`
	Visitors  float64 `json:"visitors"`
	Visits    float64 `json:"visits"`
	Bounces   float64 `json:"bounces"`
	Totaltime float64 `json:"totaltime"`
}

type ActiveVisitors struct {
	Visitors int `json:"visitors"`
}

type RealtimeResponse struct {
	Countries map[string]int `json:"countries"`
	Referrers map[string]int `json:"referrers"`
	URLs      map[string]int `json:"urls"`
	Totals    struct {
		Views     int `json:"views"`
		Visitors  int `json:"visitors"`
		Events    int `json:"events"`
		Countries int `json:"countries"`
	} `json:"totals"`
	Timestamp int64 `json:"timestamp"`
}

type EventRow struct {
	ID             string `json:"id"`
	CreatedAt      string `json:"createdAt"`
	URLPath        string `json:"urlPath"`
	URLQuery       string `json:"urlQuery,omitempty"`
	ReferrerDomain string `json:"referrerDomain,omitempty"`
	Country        string `json:"country,omitempty"`
	Device         string `json:"device,omitempty"`
	Browser        string `json:"browser,omitempty"`
	EventType      int    `json:"eventType"`
	EventName      string `json:"eventName,omitempty"`
}

type EventsResponse struct {
	Data     []EventRow `json:"data"`
	Count    int        `json:"count"`
	Page     int        `json:"page"`
	PageSize int        `json:"pageSize"`
}

type QueryParams struct {
	StartAt  int64
	EndAt    int64
	Unit     string
	Timezone string
	Filters  map[string]string
}

func New(baseURL, token string) *Client {
	clean := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	clean = strings.TrimSuffix(clean, "/api")
	return &Client{
		BaseURL: clean,
		Token:   strings.TrimSpace(token),
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) Verify(ctx context.Context) (VerifyResponse, error) {
	var out VerifyResponse
	err := c.doJSON(ctx, http.MethodPost, "/api/auth/verify", nil, nil, &out)
	return out, err
}

func (c *Client) ListWebsites(ctx context.Context, includeTeams bool, search string) ([]Website, error) {
	var all []Website
	for page := 1; ; page++ {
		q := url.Values{}
		q.Set("page", strconv.Itoa(page))
		q.Set("pageSize", "100")
		if includeTeams {
			q.Set("includeTeams", "true")
		}
		if strings.TrimSpace(search) != "" {
			q.Set("search", strings.TrimSpace(search))
		}
		var resp WebsiteList
		if err := c.doJSON(ctx, http.MethodGet, "/api/websites", q, nil, &resp); err != nil {
			return nil, err
		}
		all = append(all, resp.Data...)
		if len(resp.Data) == 0 || len(all) >= resp.Count {
			break
		}
	}
	return all, nil
}

func (c *Client) ResolveWebsite(ctx context.Context, ref string) (Website, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return Website{}, fmt.Errorf("website ID, domain, or name is required")
	}
	websites, err := c.ListWebsites(ctx, true, "")
	if err != nil {
		return Website{}, err
	}
	return MatchWebsite(websites, ref)
}

func MatchWebsite(websites []Website, ref string) (Website, error) {
	needle := normalizeSiteRef(ref)

	for _, w := range websites {
		if strings.EqualFold(w.ID, ref) {
			return w, nil
		}
	}
	for _, w := range websites {
		if normalizeSiteRef(w.Domain) == needle || strings.EqualFold(strings.TrimSpace(w.Name), ref) {
			return w, nil
		}
	}

	var partial []Website
	for _, w := range websites {
		if strings.Contains(normalizeSiteRef(w.Domain), needle) ||
			strings.Contains(strings.ToLower(w.Name), strings.ToLower(ref)) {
			partial = append(partial, w)
		}
	}
	if len(partial) == 1 {
		return partial[0], nil
	}
	if len(partial) > 1 {
		names := make([]string, 0, len(partial))
		for _, w := range partial {
			names = append(names, fmt.Sprintf("%s (%s)", w.Name, w.Domain))
		}
		return Website{}, fmt.Errorf("ambiguous website %q matches: %s", ref, strings.Join(names, ", "))
	}
	return Website{}, fmt.Errorf("website %q not found (run `umami websites` to list available sites)", ref)
}

func normalizeSiteRef(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	v = strings.TrimPrefix(v, "https://")
	v = strings.TrimPrefix(v, "http://")
	v = strings.TrimSuffix(v, "/")
	return v
}

func (c *Client) GetStats(ctx context.Context, websiteID string, p QueryParams) (WebsiteStats, error) {
	var out WebsiteStats
	err := c.doJSON(ctx, http.MethodGet, "/api/websites/"+url.PathEscape(websiteID)+"/stats", buildRangeQuery(p), nil, &out)
	return out, err
}

func (c *Client) GetPageviews(ctx context.Context, websiteID string, p QueryParams) (PageviewsResponse, error) {
	var out PageviewsResponse
	err := c.doJSON(ctx, http.MethodGet, "/api/websites/"+url.PathEscape(websiteID)+"/pageviews", buildRangeQuery(p), nil, &out)
	return out, err
}

func (c *Client) GetMetrics(ctx context.Context, websiteID, metricType string, limit int, p QueryParams) ([]MetricRow, error) {
	q := buildRangeQuery(p)
	q.Set("type", metricType)
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	var out []MetricRow
	err := c.doJSON(ctx, http.MethodGet, "/api/websites/"+url.PathEscape(websiteID)+"/metrics", q, nil, &out)
	return out, err
}

func (c *Client) GetExpandedMetrics(ctx context.Context, websiteID, metricType string, limit int, p QueryParams) ([]ExpandedMetricRow, error) {
	q := buildRangeQuery(p)
	q.Set("type", metricType)
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	var out []ExpandedMetricRow
	err := c.doJSON(ctx, http.MethodGet, "/api/websites/"+url.PathEscape(websiteID)+"/metrics/expanded", q, nil, &out)
	return out, err
}

func (c *Client) GetActive(ctx context.Context, websiteID string) (ActiveVisitors, error) {
	var out ActiveVisitors
	err := c.doJSON(ctx, http.MethodGet, "/api/websites/"+url.PathEscape(websiteID)+"/active", nil, nil, &out)
	return out, err
}

func (c *Client) GetRealtime(ctx context.Context, websiteID, timezone string) (RealtimeResponse, error) {
	q := url.Values{}
	if timezone != "" {
		q.Set("timezone", timezone)
	}
	var out RealtimeResponse
	err := c.doJSON(ctx, http.MethodGet, "/api/realtime/"+url.PathEscape(websiteID), q, nil, &out)
	return out, err
}

func (c *Client) GetEvents(ctx context.Context, websiteID string, page, pageSize int, search string, p QueryParams) (EventsResponse, error) {
	q := buildRangeQuery(p)
	if page > 0 {
		q.Set("page", strconv.Itoa(page))
	}
	if pageSize > 0 {
		q.Set("pageSize", strconv.Itoa(pageSize))
	}
	if strings.TrimSpace(search) != "" {
		q.Set("search", strings.TrimSpace(search))
	}
	var out EventsResponse
	err := c.doJSON(ctx, http.MethodGet, "/api/websites/"+url.PathEscape(websiteID)+"/events", q, nil, &out)
	return out, err
}

func buildRangeQuery(p QueryParams) url.Values {
	q := url.Values{}
	q.Set("startAt", strconv.FormatInt(p.StartAt, 10))
	q.Set("endAt", strconv.FormatInt(p.EndAt, 10))
	if p.Unit != "" {
		q.Set("unit", p.Unit)
	}
	if p.Timezone != "" {
		q.Set("timezone", p.Timezone)
	}
	for k, v := range p.Filters {
		q.Set(k, v)
	}
	return q
}

func (c *Client) doJSON(ctx context.Context, method, path string, query url.Values, body any, out any) error {
	if c.BaseURL == "" {
		return fmt.Errorf("missing Umami URL (run `umami auth login --url ... --token ...` or set UMAMI_URL)")
	}
	if c.Token == "" {
		return fmt.Errorf("missing Umami token (run `umami auth login --url ... --token ...` or set UMAMI_TOKEN)")
	}

	endpoint := c.BaseURL + path
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}

	var bodyReader io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(buf)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, bodyReader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "umami-cli")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode >= 400 {
		apiErr := &APIError{Status: resp.StatusCode}
		var envelope struct {
			Error struct {
				Message string `json:"message"`
				Code    string `json:"code"`
			} `json:"error"`
		}
		if json.Unmarshal(raw, &envelope) == nil && envelope.Error.Message != "" {
			apiErr.Message = envelope.Error.Message
			apiErr.Code = envelope.Error.Code
		} else if trimmed := strings.TrimSpace(string(raw)); trimmed != "" {
			apiErr.Message = trimmed
		}
		return apiErr
	}

	if out == nil || len(raw) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("decode %s response: %w", path, err)
	}
	return nil
}
