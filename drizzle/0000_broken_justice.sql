CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`party` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`method` text NOT NULL,
	`reference` text NOT NULL
);
