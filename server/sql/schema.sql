-- Curva Fabric B2B user-data schema
-- Products, FAQs and editorial articles intentionally remain JSON-backed.

CREATE DATABASE IF NOT EXISTS `curva_fabric_b2b`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `curva_fabric_b2b`;

CREATE TABLE IF NOT EXISTS `users` (
  `visitor_id` VARCHAR(64) NOT NULL,
  `user_data` JSON NOT NULL,
  `user_name` VARCHAR(255) GENERATED ALWAYS AS
    (LOWER(JSON_UNQUOTE(JSON_EXTRACT(`user_data`, '$.userName')))) STORED,
  `role` VARCHAR(32) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`user_data`, '$.role'))) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`visitor_id`),
  KEY `idx_users_user_name` (`user_name`),
  KEY `idx_users_role` (`role`),
  CONSTRAINT `chk_users_visitor_id` CHECK (`visitor_id` REGEXP '^[A-Za-z0-9-]{16,64}$'),
  CONSTRAINT `chk_users_json_identity` CHECK (
    `user_name` IS NOT NULL AND CHAR_LENGTH(`user_name`) BETWEEN 1 AND 255
    AND JSON_UNQUOTE(JSON_EXTRACT(`user_data`, '$.visitorId')) IS NOT NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(`user_data`, '$.visitorId')) = `visitor_id`
  )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_profiles` (
  `visitor_id` VARCHAR(64) NOT NULL,
  `profile_data` JSON NOT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`visitor_id`),
  CONSTRAINT `fk_user_profiles_visitor` FOREIGN KEY (`visitor_id`) REFERENCES `users` (`visitor_id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_events` (
  `visitor_id` VARCHAR(64) NOT NULL,
  `event_id` VARCHAR(64) NOT NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `page_path` VARCHAR(500) NULL,
  `entity_type` VARCHAR(64) NULL,
  `entity_id` VARCHAR(128) NULL,
  `event_data` JSON NULL,
  `ip_hash` CHAR(64) NULL,
  `user_agent` VARCHAR(500) NULL,
  `occurred_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`visitor_id`, `event_id`),
  KEY `idx_user_events_visitor_time` (`visitor_id`, `occurred_at`),
  KEY `idx_user_events_type_time` (`event_type`, `occurred_at`),
  KEY `idx_user_events_event_id` (`event_id`),
  CONSTRAINT `chk_user_events_visitor_id` CHECK (`visitor_id` REGEXP '^[A-Za-z0-9-]{16,64}$')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_consents` (
  `consent_id` VARCHAR(64) NOT NULL,
  `visitor_id` VARCHAR(64) NOT NULL,
  `consent_type` VARCHAR(64) NOT NULL,
  `granted` BOOLEAN NOT NULL,
  `policy_version` VARCHAR(32) NULL,
  `consent_data` JSON NULL,
  `recorded_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`consent_id`),
  KEY `idx_user_consents_visitor_type` (`visitor_id`, `consent_type`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `rfq_assortments` (
  `visitor_id` VARCHAR(64) NOT NULL,
  `assortment_data` JSON NOT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`visitor_id`),
  CONSTRAINT `chk_rfq_assortments_visitor_id` CHECK (`visitor_id` REGEXP '^[A-Za-z0-9-]{16,64}$'),
  CONSTRAINT `chk_rfq_assortments_json_identity` CHECK (
    JSON_UNQUOTE(JSON_EXTRACT(`assortment_data`, '$.visitorId')) IS NOT NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(`assortment_data`, '$.visitorId')) = `visitor_id`
  ),
  CONSTRAINT `fk_rfq_assortments_visitor` FOREIGN KEY (`visitor_id`) REFERENCES `users` (`visitor_id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `quotes` (
  `quote_id` VARCHAR(64) NOT NULL,
  `quote_data` JSON NOT NULL,
  `reference` VARCHAR(64) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.reference'))) STORED,
  `visitor_id` VARCHAR(64) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.visitorId'))) STORED,
  `user_name` VARCHAR(255) GENERATED ALWAYS AS
    (LOWER(JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.userName')))) STORED,
  `status` VARCHAR(32) GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(`quote_data`, '$.status'))) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`quote_id`),
  UNIQUE KEY `uq_quotes_reference` (`reference`),
  KEY `idx_quotes_visitor` (`visitor_id`),
  KEY `idx_quotes_user_name` (`user_name`),
  KEY `idx_quotes_status` (`status`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `im_rooms` (
  `room_id` VARCHAR(64) NOT NULL,
  `room_data` JSON NOT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`room_id`),
  CONSTRAINT `chk_im_rooms_json_identity` CHECK (
    JSON_UNQUOTE(JSON_EXTRACT(`room_data`, '$.roomId')) IS NOT NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(`room_data`, '$.roomId')) = `room_id`
  )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `im_messages` (
  `message_id` VARCHAR(64) NOT NULL,
  `room_id` VARCHAR(64) NOT NULL,
  `message_data` JSON NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`),
  KEY `idx_im_messages_room_time` (`room_id`, `created_at`),
  CONSTRAINT `chk_im_messages_json_identity` CHECK (
    JSON_UNQUOTE(JSON_EXTRACT(`message_data`, '$.id')) IS NOT NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(`message_data`, '$.id')) = `message_id`
    AND JSON_UNQUOTE(JSON_EXTRACT(`message_data`, '$.roomId')) IS NOT NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(`message_data`, '$.roomId')) = `room_id`
  ),
  CONSTRAINT `fk_im_messages_room` FOREIGN KEY (`room_id`) REFERENCES `im_rooms` (`room_id`) ON DELETE CASCADE
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
  PRIMARY KEY (`conversation_id`),
  CONSTRAINT `chk_support_conversations_json_identity` CHECK (
    JSON_UNQUOTE(JSON_EXTRACT(`conversation_data`, '$.id')) IS NOT NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(`conversation_data`, '$.id')) = `conversation_id`
  )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `support_conversation_messages` (
  `message_id` VARCHAR(64) NOT NULL,
  `conversation_id` VARCHAR(64) NOT NULL,
  `message_data` JSON NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`),
  KEY `idx_support_messages_conversation_time` (`conversation_id`, `created_at`),
  CONSTRAINT `chk_support_conversation_messages_json_identity` CHECK (
    JSON_UNQUOTE(JSON_EXTRACT(`message_data`, '$.id')) IS NOT NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(`message_data`, '$.id')) = `message_id`
    AND JSON_UNQUOTE(JSON_EXTRACT(`message_data`, '$.conversationId')) IS NOT NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(`message_data`, '$.conversationId')) = `conversation_id`
  ),
  CONSTRAINT `fk_support_conversation_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `support_conversations` (`conversation_id`) ON DELETE CASCADE
) ENGINE=InnoDB;
