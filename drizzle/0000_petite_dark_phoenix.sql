CREATE TABLE `batch_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`client_key` text NOT NULL,
	`batch_number` integer NOT NULL,
	`status` text NOT NULL,
	`total_packets` integer NOT NULL,
	`passed_packets` integer NOT NULL,
	`warning_packets` integer NOT NULL,
	`rejected_packets` integer NOT NULL,
	`oee` integer NOT NULL,
	`last_risk` integer NOT NULL,
	`event_count` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_batch_sessions_client_updated` ON `batch_sessions` (`client_key`,`updated_at`);--> statement-breakpoint
CREATE TABLE `event_records` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_time` text NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_event_records_session_created` ON `event_records` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `maintenance_work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`action` text NOT NULL,
	`repair_time` text NOT NULL,
	`maintenance_window` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_work_orders_session_created` ON `maintenance_work_orders` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `packet_records` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`packet_no` integer NOT NULL,
	`scanned_at` text NOT NULL,
	`rpm` integer NOT NULL,
	`vibration` text NOT NULL,
	`temperature` text NOT NULL,
	`current` text NOT NULL,
	`ai_result` text NOT NULL,
	`auto_action` text NOT NULL,
	`risk` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_packet_records_session_packet` ON `packet_records` (`session_id`,`packet_no`);--> statement-breakpoint
CREATE INDEX `idx_packet_records_session_created` ON `packet_records` (`session_id`,`created_at`);
