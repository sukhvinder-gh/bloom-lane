-- Add portal_background config key so admins can set a CSS background for the portal
INSERT INTO config (key, value, description)
VALUES ('portal_background', '', 'CSS background value for admin/farmer/buyer portal pages (gradient, color, or empty for default)')
ON CONFLICT (key) DO NOTHING;
