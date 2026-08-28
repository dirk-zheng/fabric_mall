-- Curva Fabric B2B user-data schema
-- Products, FAQs and editorial articles intentionally remain JSON-backed.

CREATE DATABASE IF NOT EXISTS `curva_denim_b2b`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `curva_denim_b2b`;

CREATE TABLE IF NOT EXISTS `users` (
  `user_id` VARCHAR(64) NOT NULL,
  `user_data` JSON NOT NULL,
  `username` VARCHAR(255) GENERATED ALWAYS AS
    (LOWER(JSON_UNQUOTE(JSON_EXTRACT(`user_data`, '$.username')))) STORED,
  `role` VARCHAR(32) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`user_data`, '$.role'))) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_username` (`username`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_profiles` (
  `user_id` VARCHAR(64) NOT NULL,
  `profile_data` JSON NOT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_events` (
  `event_id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NULL,
  `session_id` VARCHAR(128) NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `page_path` VARCHAR(500) NULL,
  `entity_type` VARCHAR(64) NULL,
  `entity_id` VARCHAR(128) NULL,
  `event_data` JSON NULL,
  `ip_hash` CHAR(64) NULL,
  `user_agent` VARCHAR(500) NULL,
  `occurred_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`event_id`),
  KEY `idx_user_events_user_time` (`user_id`, `occurred_at`),
  KEY `idx_user_events_type_time` (`event_type`, `occurred_at`),
  KEY `idx_user_events_session` (`session_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_consents` (
  `consent_id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NULL,
  `session_id` VARCHAR(128) NULL,
  `consent_type` VARCHAR(64) NOT NULL,
  `granted` BOOLEAN NOT NULL,
  `policy_version` VARCHAR(32) NULL,
  `consent_data` JSON NULL,
  `recorded_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`consent_id`),
  KEY `idx_user_consents_user_type` (`user_id`, `consent_type`),
  KEY `idx_user_consents_session` (`session_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `rfq_assortments` (
  `user_id` VARCHAR(64) NOT NULL,
  `assortment_data` JSON NOT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `quotes` (
  `quote_id` VARCHAR(64) NOT NULL,
  `quote_data` JSON NOT NULL,
  `reference` VARCHAR(64) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.reference'))) STORED,
  `user_id` VARCHAR(64) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.userId'))) STORED,
  `status` VARCHAR(32) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.status'))) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`quote_id`),
  UNIQUE KEY `uq_quotes_reference` (`reference`),
  KEY `idx_quotes_user` (`user_id`),
  KEY `idx_quotes_status` (`status`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `im_rooms` (
  `room_id` VARCHAR(64) NOT NULL,
  `room_data` JSON NOT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`room_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `im_messages` (
  `message_id` VARCHAR(64) NOT NULL,
  `room_id` VARCHAR(64) NOT NULL,
  `message_data` JSON NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`),
  KEY `idx_im_messages_room_time` (`room_id`, `created_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `support_messages` (
  `message_id` VARCHAR(64) NOT NULL,
  `message_data` JSON NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `support_conversations` (
  `conversation_id` VARCHAR(64) NOT NULL,
  `conversation_data` JSON NOT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`conversation_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `support_conversation_messages` (
  `message_id` VARCHAR(64) NOT NULL,
  `conversation_id` VARCHAR(64) NOT NULL,
  `message_data` JSON NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`),
  KEY `idx_support_messages_conversation_time` (`conversation_id`, `created_at`)
) ENGINE=InnoDB;
