CREATE TABLE `collection_memories` (
	`collectionId` int NOT NULL,
	`memoryId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collection_memories_pair_unique` UNIQUE(`collectionId`,`memoryId`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`color` varchar(24) NOT NULL DEFAULT 'violet',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`seedKey` varchar(100),
	`title` varchar(240) NOT NULL,
	`content` longtext NOT NULL,
	`source` text,
	`sourceUrl` text,
	`sourceType` enum('note','text','url','image','screenshot') NOT NULL DEFAULT 'note',
	`category` varchar(80) NOT NULL DEFAULT 'Unsorted',
	`summary` text,
	`keyConcepts` json NOT NULL,
	`tags` json NOT NULL,
	`attachmentData` longtext,
	`attachmentName` varchar(240),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memories_id` PRIMARY KEY(`id`),
	CONSTRAINT `memories_owner_seed_unique` UNIQUE(`ownerId`,`seedKey`)
);
--> statement-breakpoint
CREATE TABLE `memory_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memoryAId` int NOT NULL,
	`memoryBId` int NOT NULL,
	`relation` varchar(120) NOT NULL DEFAULT 'related',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memory_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `memory_links_pair_unique` UNIQUE(`memoryAId`,`memoryBId`)
);
--> statement-breakpoint
CREATE TABLE `workspace_meta` (
	`key` varchar(80) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_meta_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `collection_memories` ADD CONSTRAINT `collection_memories_collectionId_collections_id_fk` FOREIGN KEY (`collectionId`) REFERENCES `collections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collection_memories` ADD CONSTRAINT `collection_memories_memoryId_memories_id_fk` FOREIGN KEY (`memoryId`) REFERENCES `memories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collections` ADD CONSTRAINT `collections_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memories` ADD CONSTRAINT `memories_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memory_links` ADD CONSTRAINT `memory_links_memoryAId_memories_id_fk` FOREIGN KEY (`memoryAId`) REFERENCES `memories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memory_links` ADD CONSTRAINT `memory_links_memoryBId_memories_id_fk` FOREIGN KEY (`memoryBId`) REFERENCES `memories`(`id`) ON DELETE cascade ON UPDATE no action;