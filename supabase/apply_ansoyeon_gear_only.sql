-- RETIRED: the temporary gear_only restriction was removed on 2026-09-22.
-- Keep this guard so the old restriction cannot be reapplied accidentally.
DO $$
BEGIN
  RAISE EXCEPTION
    'This script is retired. The teacher now uses the normal full access scope.';
END $$;
