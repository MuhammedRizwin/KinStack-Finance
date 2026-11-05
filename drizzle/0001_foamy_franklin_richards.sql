CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`transaction_id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `currency` text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `client_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `document_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `recurring_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `period` text;--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_payment_unique` ON `transactions` (`owner`,`recurring_id`,`period`);