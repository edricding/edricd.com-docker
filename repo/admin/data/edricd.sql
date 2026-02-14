/*
 Navicat Premium Dump SQL

 Source Server         : edricd
 Source Server Type    : MySQL
 Source Server Version : 80408 (8.4.8)
 Source Host           : 66.42.72.165:3306
 Source Schema         : edricd

 Target Server Type    : MySQL
 Target Server Version : 80408 (8.4.8)
 File Encoding         : 65001

 Date: 14/02/2026 11:24:59
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for reminder_audio_library
-- ----------------------------
DROP TABLE IF EXISTS `reminder_audio_library`;
CREATE TABLE `reminder_audio_library`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `gcs_url` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `url_sha256` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (sha2(`gcs_url`,256)) STORED NULL,
  `mime_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `duration_seconds` smallint UNSIGNED NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_reminder_audio_url_sha256`(`url_sha256` ASC) USING BTREE,
  INDEX `idx_reminder_audio_active`(`is_active` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for reminder_preset
-- ----------------------------
DROP TABLE IF EXISTS `reminder_preset`;
CREATE TABLE `reminder_preset`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_min` smallint UNSIGNED NOT NULL,
  `audio_id` bigint UNSIGNED NULL DEFAULT NULL,
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` smallint UNSIGNED NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_reminder_preset_enabled_sort`(`is_enabled` ASC, `sort_order` ASC, `id` ASC) USING BTREE,
  INDEX `idx_reminder_preset_audio`(`audio_id` ASC) USING BTREE,
  CONSTRAINT `chk_reminder_preset_duration` CHECK (`duration_min` between 1 and 1439)
) ENGINE = InnoDB AUTO_INCREMENT = 16 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for reminder_schedule_config
-- ----------------------------
DROP TABLE IF EXISTS `reminder_schedule_config`;
CREATE TABLE `reminder_schedule_config`  (
  `id` tinyint UNSIGNED NOT NULL,
  `timezone_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Asia/Shanghai',
  PRIMARY KEY (`id`) USING BTREE,
  CONSTRAINT `chk_reminder_schedule_config_singleton` CHECK (`id` = 1)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for reminder_schedule_slot
-- ----------------------------
DROP TABLE IF EXISTS `reminder_schedule_slot`;
CREATE TABLE `reminder_schedule_slot`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `weekday` tinyint UNSIGNED NOT NULL COMMENT '1=Mon ... 7=Sun',
  `start_min` smallint UNSIGNED NOT NULL COMMENT '0..1439',
  `end_min` smallint UNSIGNED NOT NULL COMMENT '1..1440, end-exclusive',
  `title` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `audio_id` bigint UNSIGNED NULL DEFAULT NULL,
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` smallint UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_reminder_slot_lookup`(`weekday` ASC, `is_enabled` ASC, `start_min` ASC, `end_min` ASC) USING BTREE,
  INDEX `idx_reminder_slot_audio`(`audio_id` ASC) USING BTREE,
  CONSTRAINT `fk_reminder_slot_audio` FOREIGN KEY (`audio_id`) REFERENCES `reminder_audio_library` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_reminder_slot_end` CHECK (`end_min` between 1 and 1440),
  CONSTRAINT `chk_reminder_slot_range` CHECK (`start_min` < `end_min`),
  CONSTRAINT `chk_reminder_slot_start` CHECK (`start_min` between 0 and 1439),
  CONSTRAINT `chk_reminder_slot_weekday` CHECK (`weekday` between 1 and 7)
) ENGINE = InnoDB AUTO_INCREMENT = 38 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for user
-- ----------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_login_time` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_user_username`(`username` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

SET FOREIGN_KEY_CHECKS = 1;
