import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('check_flyway_migrations', ROOT / 'scripts/check_flyway_migrations.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class FlywayMigrationTest(unittest.TestCase):
    def check_names(self, *names):
        with tempfile.TemporaryDirectory(prefix='carehub-migration-test-') as directory:
            for name in names:
                (Path(directory) / name).write_text('-- migration fixture\n')
            return checker.check_migrations(directory)

    def test_duplicate_production_version_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate Flyway version 32'):
            self.check_names('V32__exam_blueprint_by_category.sql', 'V32__accent_insensitive_search.sql')

    def test_new_search_version_preserves_existing_exam_versions(self):
        self.assertEqual(self.check_names('V32__exam_blueprint_by_category.sql',
                                         'V33__exam_attempt_proctoring_tab_switch.sql',
                                         'V34__accent_insensitive_search.sql'), 3)

    def test_equivalent_version_notation_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate Flyway version 3.1'):
            self.check_names('V03_01__first.sql', 'V3.1.0__second.sql')

    def test_repeatable_migrations_are_not_version_collisions(self):
        self.assertEqual(self.check_names('V1__initial.sql', 'R__refresh_view.sql'), 1)

    def test_repository_versions_are_unique(self):
        self.assertGreater(checker.check_migrations(ROOT / 'carehub-backend/src/main/resources/db/migration'), 0)


if __name__ == '__main__':
    unittest.main()
