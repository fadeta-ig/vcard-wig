-- Reserve prior slugs discoverable in the existing audit trail as well.
INSERT IGNORE INTO `ProfileSlugReservation` (`slugHash`, `profileId`)
SELECT SHA2(CONCAT('profile-slug:', JSON_UNQUOTE(JSON_EXTRACT(a.`oldValues`, '$.slug'))), 256), p.`id`
FROM `AuditLog` a LEFT JOIN `ContactProfile` p ON p.`id` = a.`entityId`
WHERE a.`entityType` = 'ContactProfile'
  AND JSON_UNQUOTE(JSON_EXTRACT(a.`oldValues`, '$.slug')) REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$';
INSERT IGNORE INTO `ProfileSlugReservation` (`slugHash`, `profileId`)
SELECT SHA2(CONCAT('profile-slug:', JSON_UNQUOTE(JSON_EXTRACT(a.`newValues`, '$.slug'))), 256), p.`id`
FROM `AuditLog` a LEFT JOIN `ContactProfile` p ON p.`id` = a.`entityId`
WHERE a.`entityType` = 'ContactProfile'
  AND JSON_UNQUOTE(JSON_EXTRACT(a.`newValues`, '$.slug')) REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$';
