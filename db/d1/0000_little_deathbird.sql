CREATE TABLE `app_setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team` (
	`team_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`access_code` text,
	`logo_url` text,
	`two_factor_required` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`deleted_at` text,
	CONSTRAINT "team_name_length" CHECK(length("team"."name") <= 50),
	CONSTRAINT "team_access_code_length" CHECK(length("team"."access_code") <= 50),
	CONSTRAINT "team_logo_url_length" CHECK(length("team"."logo_url") <= 2183)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_access_code_unique` ON `team` (`access_code`);--> statement-breakpoint
CREATE INDEX `team_access_code_idx` ON `team` (`access_code`);--> statement-breakpoint
CREATE TABLE `team_user` (
	`team_user_id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "team_user_role_length" CHECK(length("team_user"."role") <= 50)
);
--> statement-breakpoint
CREATE INDEX `team_user_team_id_idx` ON `team_user` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_user_user_id_idx` ON `team_user` (`user_id`);--> statement-breakpoint
CREATE TABLE `two_factor_auth` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`secret` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `two_factor_auth_user_id_unique` ON `two_factor_auth` (`user_id`);--> statement-breakpoint
CREATE TABLE `two_factor_backup_code` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `two_factor_backup_code_user_id_idx` ON `two_factor_backup_code` (`user_id`);--> statement-breakpoint
CREATE TABLE `two_factor_otp_used` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`otp` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `two_factor_otp_used_user_id_otp_key` ON `two_factor_otp_used` (`user_id`,`otp`);--> statement-breakpoint
CREATE TABLE `two_factor_rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "two_factor_rate_limit_attempts_range" CHECK("two_factor_rate_limit"."attempts" between -2147483648 and 2147483647)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `two_factor_rate_limit_user_id_unique` ON `two_factor_rate_limit` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`role` text NOT NULL,
	`logo_url` text,
	`display_name` text,
	`two_factor_required` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`deleted_at` text,
	CONSTRAINT "user_username_length" CHECK(length("user"."username") <= 255),
	CONSTRAINT "user_password_length" CHECK(length("user"."password") <= 60),
	CONSTRAINT "user_role_length" CHECK(length("user"."role") <= 50),
	CONSTRAINT "user_logo_url_length" CHECK(length("user"."logo_url") <= 2183),
	CONSTRAINT "user_display_name_length" CHECK(length("user"."display_name") <= 255)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `event_data` (
	`event_data_id` text PRIMARY KEY NOT NULL,
	`website_id` text NOT NULL,
	`website_event_id` text NOT NULL,
	`data_key` text NOT NULL,
	`string_value` text,
	`number_value` text,
	`date_value` text,
	`data_type` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "event_data_data_key_length" CHECK(length("event_data"."data_key") <= 500),
	CONSTRAINT "event_data_string_value_length" CHECK(length("event_data"."string_value") <= 500),
	CONSTRAINT "event_data_data_type_range" CHECK("event_data"."data_type" between -2147483648 and 2147483647)
);
--> statement-breakpoint
CREATE INDEX `event_data_created_at_idx` ON `event_data` (`created_at`);--> statement-breakpoint
CREATE INDEX `event_data_website_id_idx` ON `event_data` (`website_id`);--> statement-breakpoint
CREATE INDEX `event_data_website_event_id_idx` ON `event_data` (`website_event_id`);--> statement-breakpoint
CREATE INDEX `event_data_website_id_created_at_idx` ON `event_data` (`website_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `event_data_website_id_created_at_data_key_idx` ON `event_data` (`website_id`,`created_at`,`data_key`);--> statement-breakpoint
CREATE TABLE `heatmap_event` (
	`heatmap_event_id` text PRIMARY KEY NOT NULL,
	`website_id` text NOT NULL,
	`session_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`url_path` text NOT NULL,
	`event_type` integer NOT NULL,
	`x` integer,
	`y` integer,
	`page_x` integer,
	`page_y` integer,
	`page_w` integer,
	`viewport_w` integer,
	`viewport_h` integer,
	`page_h` integer,
	`scroll_pct` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "heatmap_event_url_path_length" CHECK(length("heatmap_event"."url_path") <= 500),
	CONSTRAINT "heatmap_event_event_type_range" CHECK("heatmap_event"."event_type" between -2147483648 and 2147483647),
	CONSTRAINT "heatmap_event_x_range" CHECK("heatmap_event"."x" between -2147483648 and 2147483647),
	CONSTRAINT "heatmap_event_y_range" CHECK("heatmap_event"."y" between -2147483648 and 2147483647),
	CONSTRAINT "heatmap_event_page_x_range" CHECK("heatmap_event"."page_x" between -2147483648 and 2147483647),
	CONSTRAINT "heatmap_event_page_y_range" CHECK("heatmap_event"."page_y" between -2147483648 and 2147483647),
	CONSTRAINT "heatmap_event_page_w_range" CHECK("heatmap_event"."page_w" between -2147483648 and 2147483647),
	CONSTRAINT "heatmap_event_viewport_w_range" CHECK("heatmap_event"."viewport_w" between -2147483648 and 2147483647),
	CONSTRAINT "heatmap_event_viewport_h_range" CHECK("heatmap_event"."viewport_h" between -2147483648 and 2147483647),
	CONSTRAINT "heatmap_event_page_h_range" CHECK("heatmap_event"."page_h" between -2147483648 and 2147483647),
	CONSTRAINT "heatmap_event_scroll_pct_range" CHECK("heatmap_event"."scroll_pct" between -2147483648 and 2147483647)
);
--> statement-breakpoint
CREATE INDEX `heatmap_event_website_id_idx` ON `heatmap_event` (`website_id`);--> statement-breakpoint
CREATE INDEX `heatmap_event_visit_id_idx` ON `heatmap_event` (`visit_id`);--> statement-breakpoint
CREATE INDEX `heatmap_event_website_id_created_at_idx` ON `heatmap_event` (`website_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `heatmap_event_website_id_url_path_event_type_created_at_idx` ON `heatmap_event` (`website_id`,`url_path`,`event_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `revenue` (
	`revenue_id` text PRIMARY KEY NOT NULL,
	`website_id` text NOT NULL,
	`session_id` text NOT NULL,
	`event_id` text NOT NULL,
	`event_name` text NOT NULL,
	`currency` text NOT NULL,
	`revenue` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "revenue_event_name_length" CHECK(length("revenue"."event_name") <= 50),
	CONSTRAINT "revenue_currency_length" CHECK(length("revenue"."currency") <= 10)
);
--> statement-breakpoint
CREATE INDEX `revenue_website_id_idx` ON `revenue` (`website_id`);--> statement-breakpoint
CREATE INDEX `revenue_session_id_idx` ON `revenue` (`session_id`);--> statement-breakpoint
CREATE INDEX `revenue_website_id_created_at_idx` ON `revenue` (`website_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `revenue_website_id_session_id_created_at_idx` ON `revenue` (`website_id`,`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`session_id` text PRIMARY KEY NOT NULL,
	`website_id` text NOT NULL,
	`browser` text,
	`os` text,
	`device` text,
	`screen` text,
	`language` text,
	`country` text,
	`region` text,
	`city` text,
	`distinct_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "session_browser_length" CHECK(length("session"."browser") <= 20),
	CONSTRAINT "session_os_length" CHECK(length("session"."os") <= 20),
	CONSTRAINT "session_device_length" CHECK(length("session"."device") <= 20),
	CONSTRAINT "session_screen_length" CHECK(length("session"."screen") <= 11),
	CONSTRAINT "session_language_length" CHECK(length("session"."language") <= 35),
	CONSTRAINT "session_country_length" CHECK(length("session"."country") <= 2),
	CONSTRAINT "session_region_length" CHECK(length("session"."region") <= 20),
	CONSTRAINT "session_city_length" CHECK(length("session"."city") <= 50),
	CONSTRAINT "session_distinct_id_length" CHECK(length("session"."distinct_id") <= 50)
);
--> statement-breakpoint
CREATE INDEX `session_created_at_idx` ON `session` (`created_at`);--> statement-breakpoint
CREATE INDEX `session_website_id_idx` ON `session` (`website_id`);--> statement-breakpoint
CREATE INDEX `session_website_id_created_at_idx` ON `session` (`website_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `session_website_id_created_at_browser_idx` ON `session` (`website_id`,`created_at`,`browser`);--> statement-breakpoint
CREATE INDEX `session_website_id_created_at_os_idx` ON `session` (`website_id`,`created_at`,`os`);--> statement-breakpoint
CREATE INDEX `session_website_id_created_at_device_idx` ON `session` (`website_id`,`created_at`,`device`);--> statement-breakpoint
CREATE INDEX `session_website_id_created_at_screen_idx` ON `session` (`website_id`,`created_at`,`screen`);--> statement-breakpoint
CREATE INDEX `session_website_id_created_at_language_idx` ON `session` (`website_id`,`created_at`,`language`);--> statement-breakpoint
CREATE INDEX `session_website_id_created_at_country_idx` ON `session` (`website_id`,`created_at`,`country`);--> statement-breakpoint
CREATE INDEX `session_website_id_created_at_region_idx` ON `session` (`website_id`,`created_at`,`region`);--> statement-breakpoint
CREATE INDEX `session_website_id_created_at_city_idx` ON `session` (`website_id`,`created_at`,`city`);--> statement-breakpoint
CREATE TABLE `session_data` (
	`session_data_id` text PRIMARY KEY NOT NULL,
	`website_id` text NOT NULL,
	`session_id` text NOT NULL,
	`data_key` text NOT NULL,
	`string_value` text,
	`number_value` text,
	`date_value` text,
	`data_type` integer NOT NULL,
	`distinct_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "session_data_data_key_length" CHECK(length("session_data"."data_key") <= 500),
	CONSTRAINT "session_data_string_value_length" CHECK(length("session_data"."string_value") <= 500),
	CONSTRAINT "session_data_data_type_range" CHECK("session_data"."data_type" between -2147483648 and 2147483647),
	CONSTRAINT "session_data_distinct_id_length" CHECK(length("session_data"."distinct_id") <= 50)
);
--> statement-breakpoint
CREATE INDEX `session_data_created_at_idx` ON `session_data` (`created_at`);--> statement-breakpoint
CREATE INDEX `session_data_website_id_idx` ON `session_data` (`website_id`);--> statement-breakpoint
CREATE INDEX `session_data_session_id_idx` ON `session_data` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_data_session_id_created_at_idx` ON `session_data` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `session_data_website_id_created_at_data_key_idx` ON `session_data` (`website_id`,`created_at`,`data_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_data_session_id_data_key_key` ON `session_data` (`session_id`,`data_key`);--> statement-breakpoint
CREATE TABLE `session_link` (
	`website_id` text NOT NULL,
	`session_id` text NOT NULL,
	`distinct_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY(`website_id`, `distinct_id`, `session_id`),
	CONSTRAINT "session_link_distinct_id_length" CHECK(length("session_link"."distinct_id") <= 50)
);
--> statement-breakpoint
CREATE INDEX `session_link_website_id_session_id_idx` ON `session_link` (`website_id`,`session_id`);--> statement-breakpoint
CREATE TABLE `session_replay` (
	`replay_id` text PRIMARY KEY NOT NULL,
	`website_id` text NOT NULL,
	`session_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`events` blob NOT NULL,
	`event_count` integer NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "session_replay_chunk_index_range" CHECK("session_replay"."chunk_index" between -2147483648 and 2147483647),
	CONSTRAINT "session_replay_event_count_range" CHECK("session_replay"."event_count" between -2147483648 and 2147483647)
);
--> statement-breakpoint
CREATE INDEX `session_replay_website_id_idx` ON `session_replay` (`website_id`);--> statement-breakpoint
CREATE INDEX `session_replay_session_id_idx` ON `session_replay` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_replay_visit_id_idx` ON `session_replay` (`visit_id`);--> statement-breakpoint
CREATE INDEX `session_replay_website_id_session_id_idx` ON `session_replay` (`website_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `session_replay_website_id_visit_id_idx` ON `session_replay` (`website_id`,`visit_id`);--> statement-breakpoint
CREATE INDEX `session_replay_website_id_created_at_idx` ON `session_replay` (`website_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `session_replay_session_id_chunk_index_idx` ON `session_replay` (`session_id`,`chunk_index`);--> statement-breakpoint
CREATE TABLE `session_replay_saved` (
	`saved_replay_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`website_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "session_replay_saved_name_length" CHECK(length("session_replay_saved"."name") <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_replay_saved_website_id_visit_id_key` ON `session_replay_saved` (`website_id`,`visit_id`);--> statement-breakpoint
CREATE INDEX `session_replay_saved_website_id_idx` ON `session_replay_saved` (`website_id`);--> statement-breakpoint
CREATE INDEX `session_replay_saved_visit_id_idx` ON `session_replay_saved` (`visit_id`);--> statement-breakpoint
CREATE INDEX `session_replay_saved_website_id_created_at_idx` ON `session_replay_saved` (`website_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `website_event` (
	`event_id` text PRIMARY KEY NOT NULL,
	`website_id` text NOT NULL,
	`session_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`url_path` text NOT NULL,
	`url_query` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`utm_content` text,
	`utm_term` text,
	`referrer_path` text,
	`referrer_query` text,
	`referrer_domain` text,
	`page_title` text,
	`gclid` text,
	`fbclid` text,
	`msclkid` text,
	`ttclid` text,
	`li_fat_id` text,
	`twclid` text,
	`event_type` integer DEFAULT 1 NOT NULL,
	`event_name` text,
	`tag` text,
	`hostname` text,
	`lcp` text,
	`inp` text,
	`cls` text,
	`fcp` text,
	`ttfb` text,
	CONSTRAINT "website_event_url_path_length" CHECK(length("website_event"."url_path") <= 500),
	CONSTRAINT "website_event_url_query_length" CHECK(length("website_event"."url_query") <= 500),
	CONSTRAINT "website_event_utm_source_length" CHECK(length("website_event"."utm_source") <= 255),
	CONSTRAINT "website_event_utm_medium_length" CHECK(length("website_event"."utm_medium") <= 255),
	CONSTRAINT "website_event_utm_campaign_length" CHECK(length("website_event"."utm_campaign") <= 255),
	CONSTRAINT "website_event_utm_content_length" CHECK(length("website_event"."utm_content") <= 255),
	CONSTRAINT "website_event_utm_term_length" CHECK(length("website_event"."utm_term") <= 255),
	CONSTRAINT "website_event_referrer_path_length" CHECK(length("website_event"."referrer_path") <= 500),
	CONSTRAINT "website_event_referrer_query_length" CHECK(length("website_event"."referrer_query") <= 500),
	CONSTRAINT "website_event_referrer_domain_length" CHECK(length("website_event"."referrer_domain") <= 500),
	CONSTRAINT "website_event_page_title_length" CHECK(length("website_event"."page_title") <= 500),
	CONSTRAINT "website_event_gclid_length" CHECK(length("website_event"."gclid") <= 255),
	CONSTRAINT "website_event_fbclid_length" CHECK(length("website_event"."fbclid") <= 255),
	CONSTRAINT "website_event_msclkid_length" CHECK(length("website_event"."msclkid") <= 255),
	CONSTRAINT "website_event_ttclid_length" CHECK(length("website_event"."ttclid") <= 255),
	CONSTRAINT "website_event_li_fat_id_length" CHECK(length("website_event"."li_fat_id") <= 255),
	CONSTRAINT "website_event_twclid_length" CHECK(length("website_event"."twclid") <= 255),
	CONSTRAINT "website_event_event_type_range" CHECK("website_event"."event_type" between -2147483648 and 2147483647),
	CONSTRAINT "website_event_event_name_length" CHECK(length("website_event"."event_name") <= 50),
	CONSTRAINT "website_event_tag_length" CHECK(length("website_event"."tag") <= 50),
	CONSTRAINT "website_event_hostname_length" CHECK(length("website_event"."hostname") <= 100)
);
--> statement-breakpoint
CREATE INDEX `website_event_created_at_idx` ON `website_event` (`created_at`);--> statement-breakpoint
CREATE INDEX `website_event_session_id_idx` ON `website_event` (`session_id`);--> statement-breakpoint
CREATE INDEX `website_event_visit_id_idx` ON `website_event` (`visit_id`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_idx` ON `website_event` (`website_id`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_created_at_idx` ON `website_event` (`website_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_created_at_url_path_idx` ON `website_event` (`website_id`,`created_at`,`url_path`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_created_at_url_query_idx` ON `website_event` (`website_id`,`created_at`,`url_query`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_created_at_referrer_domain_idx` ON `website_event` (`website_id`,`created_at`,`referrer_domain`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_created_at_page_title_idx` ON `website_event` (`website_id`,`created_at`,`page_title`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_created_at_event_name_idx` ON `website_event` (`website_id`,`created_at`,`event_name`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_created_at_tag_idx` ON `website_event` (`website_id`,`created_at`,`tag`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_session_id_created_at_idx` ON `website_event` (`website_id`,`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_visit_id_created_at_idx` ON `website_event` (`website_id`,`visit_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `website_event_website_id_created_at_hostname_idx` ON `website_event` (`website_id`,`created_at`,`hostname`);--> statement-breakpoint
CREATE TABLE `board` (
	`board_id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`parameters` text NOT NULL,
	`user_id` text,
	`team_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "board_type_length" CHECK(length("board"."type") <= 50),
	CONSTRAINT "board_name_length" CHECK(length("board"."name") <= 200),
	CONSTRAINT "board_description_length" CHECK(length("board"."description") <= 500)
);
--> statement-breakpoint
CREATE INDEX `board_user_id_idx` ON `board` (`user_id`);--> statement-breakpoint
CREATE INDEX `board_team_id_idx` ON `board` (`team_id`);--> statement-breakpoint
CREATE INDEX `board_created_at_idx` ON `board` (`created_at`);--> statement-breakpoint
CREATE TABLE `link` (
	`link_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`slug` text NOT NULL,
	`user_id` text,
	`team_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`deleted_at` text,
	CONSTRAINT "link_name_length" CHECK(length("link"."name") <= 100),
	CONSTRAINT "link_url_length" CHECK(length("link"."url") <= 500),
	CONSTRAINT "link_slug_length" CHECK(length("link"."slug") <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `link_slug_unique` ON `link` (`slug`);--> statement-breakpoint
CREATE INDEX `link_slug_idx` ON `link` (`slug`);--> statement-breakpoint
CREATE INDEX `link_user_id_idx` ON `link` (`user_id`);--> statement-breakpoint
CREATE INDEX `link_team_id_idx` ON `link` (`team_id`);--> statement-breakpoint
CREATE INDEX `link_created_at_idx` ON `link` (`created_at`);--> statement-breakpoint
CREATE TABLE `pixel` (
	`pixel_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`user_id` text,
	`team_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`deleted_at` text,
	CONSTRAINT "pixel_name_length" CHECK(length("pixel"."name") <= 100),
	CONSTRAINT "pixel_slug_length" CHECK(length("pixel"."slug") <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pixel_slug_unique` ON `pixel` (`slug`);--> statement-breakpoint
CREATE INDEX `pixel_slug_idx` ON `pixel` (`slug`);--> statement-breakpoint
CREATE INDEX `pixel_user_id_idx` ON `pixel` (`user_id`);--> statement-breakpoint
CREATE INDEX `pixel_team_id_idx` ON `pixel` (`team_id`);--> statement-breakpoint
CREATE INDEX `pixel_created_at_idx` ON `pixel` (`created_at`);--> statement-breakpoint
CREATE TABLE `report` (
	`report_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`website_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`parameters` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "report_type_length" CHECK(length("report"."type") <= 50),
	CONSTRAINT "report_name_length" CHECK(length("report"."name") <= 200),
	CONSTRAINT "report_description_length" CHECK(length("report"."description") <= 500)
);
--> statement-breakpoint
CREATE INDEX `report_user_id_idx` ON `report` (`user_id`);--> statement-breakpoint
CREATE INDEX `report_website_id_idx` ON `report` (`website_id`);--> statement-breakpoint
CREATE INDEX `report_type_idx` ON `report` (`type`);--> statement-breakpoint
CREATE INDEX `report_name_idx` ON `report` (`name`);--> statement-breakpoint
CREATE TABLE `segment` (
	`segment_id` text PRIMARY KEY NOT NULL,
	`website_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`parameters` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "segment_type_length" CHECK(length("segment"."type") <= 50),
	CONSTRAINT "segment_name_length" CHECK(length("segment"."name") <= 200)
);
--> statement-breakpoint
CREATE INDEX `segment_website_id_idx` ON `segment` (`website_id`);--> statement-breakpoint
CREATE TABLE `share` (
	`share_id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`name` text NOT NULL,
	`share_type` integer NOT NULL,
	`slug` text NOT NULL,
	`parameters` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CONSTRAINT "share_name_length" CHECK(length("share"."name") <= 200),
	CONSTRAINT "share_share_type_range" CHECK("share"."share_type" between -2147483648 and 2147483647),
	CONSTRAINT "share_slug_length" CHECK(length("share"."slug") <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_slug_unique` ON `share` (`slug`);--> statement-breakpoint
CREATE INDEX `share_entity_id_idx` ON `share` (`entity_id`);--> statement-breakpoint
CREATE TABLE `website` (
	`website_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`reset_at` text,
	`user_id` text,
	`team_id` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`deleted_at` text,
	`recorder_enabled` integer DEFAULT false NOT NULL,
	`replay_config` text,
	CONSTRAINT "website_name_length" CHECK(length("website"."name") <= 100),
	CONSTRAINT "website_domain_length" CHECK(length("website"."domain") <= 500)
);
--> statement-breakpoint
CREATE INDEX `website_user_id_idx` ON `website` (`user_id`);--> statement-breakpoint
CREATE INDEX `website_team_id_idx` ON `website` (`team_id`);--> statement-breakpoint
CREATE INDEX `website_created_at_idx` ON `website` (`created_at`);--> statement-breakpoint
CREATE INDEX `website_created_by_idx` ON `website` (`created_by`);