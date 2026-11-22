CREATE TABLE `api_token` (
	`token_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_prefix` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "api_token_name_length" CHECK(length("api_token"."name") <= 100),
	CONSTRAINT "api_token_prefix_length" CHECK(length("api_token"."token_prefix") <= 32)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_token_token_hash_unique` ON `api_token` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_token_user_id_idx` ON `api_token` (`user_id`);