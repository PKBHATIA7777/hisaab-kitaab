/* eslint-disable no-camelcase */

/**
 * Migration: Add related_entity_id to notifications
 *
 * Adds the related_entity_id column to the notifications table to support
 * tracking the specific entity (e.g. settlement record id) a notification is about.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS related_entity_id INTEGER;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE notifications
      DROP COLUMN IF EXISTS related_entity_id;
  `);
};
