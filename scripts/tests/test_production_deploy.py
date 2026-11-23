"""Exercise the production workflow with real Git repositories and a fake Docker CLI.

Run: python3 -m unittest discover -s scripts/tests -p 'test_production_deploy.py'
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/deploy-prod.yml'


def git(directory, *args):
    return subprocess.check_output(
        ['git', '-C', str(directory), *args], stderr=subprocess.DEVNULL, text=True,
    ).strip()


class ProductionDeployTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='carehub-deploy-test-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.origin = self.base / 'origin'
        self.source = self.base / 'source'
        self.checkout = self.base / 'vps'
        self.source.mkdir()
        git(self.base, 'init', '--bare', '--initial-branch=production', str(self.origin))
        git(self.source, 'init', '--initial-branch=production')
        git(self.source, 'config', 'user.name', 'Deployment Test')
        git(self.source, 'config', 'user.email', 'deployment-test@example.invalid')
        (self.source / 'Caddyfile').write_text('original configuration\n')
        migration_dir = self.source / 'carehub-backend/src/main/resources/db/migration'
        migration_dir.mkdir(parents=True)
        (migration_dir / 'V1__initial.sql').write_text('-- fixture\n')
        (self.source / 'scripts').mkdir()
        (self.source / 'scripts/check_flyway_migrations.py').write_text(
            (ROOT / 'scripts/check_flyway_migrations.py').read_text())
        git(self.source, 'add', '.')
        git(self.source, 'commit', '-qm', 'Initial deployment')
        git(self.source, 'remote', 'add', 'origin', str(self.origin))
        git(self.source, 'push', '-q', 'origin', 'production')
        git(self.base, 'clone', '-q', str(self.origin), str(self.checkout))
        (self.source / 'Caddyfile').write_text('updated production configuration\n')
        git(self.source, 'commit', '-qam', 'New production release')
        git(self.source, 'push', '-q', 'origin', 'production')
        self.expected_sha = git(self.source, 'rev-parse', 'HEAD')
        self.bin_dir = self.base / 'bin'
        self.bin_dir.mkdir()
        self.docker_log = self.base / 'docker.jsonl'
        docker = self.bin_dir / 'docker'
        docker.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import json, os, sys
            args = sys.argv[1:]
            with open(os.environ['DEPLOY_TEST_DOCKER_LOG'], 'a') as log:
                log.write(json.dumps(args) + '\\n')
            failure = os.environ.get('DEPLOY_TEST_DOCKER_FAILURE')
            if (failure == 'build' and 'build' in args) or (failure == 'health' and 'up' in args):
                sys.exit(1)
        '''))
        docker.chmod(0o755)

    def deploy(self, failure='', expected_sha=None):
        source = Path(os.environ.get('DEPLOY_TEST_WORKFLOW', str(WORKFLOW))).read_text()
        block = source.split('          script: |\n', 1)[1]
        script = textwrap.dedent(block)
        script = script.replace('cd /opt/carehub', 'cd "$DEPLOY_TEST_CHECKOUT"')
        script = script.replace('${{ github.sha }}', expected_sha or self.expected_sha)
        env = {
            **os.environ,
            'PATH': str(self.bin_dir) + os.pathsep + os.environ['PATH'],
            'DEPLOY_TEST_CHECKOUT': str(self.checkout),
            'DEPLOY_TEST_DOCKER_LOG': str(self.docker_log),
            'DEPLOY_TEST_DOCKER_FAILURE': failure,
        }
        result = subprocess.run(['bash', '-c', script], env=env, capture_output=True, text=True)
        calls = [json.loads(line) for line in self.docker_log.read_text().splitlines()] if self.docker_log.exists() else []
        return result, calls

    def test_dirty_server_configuration_stops_before_build(self):
        (self.checkout / 'Caddyfile').write_text('custom server configuration\n')
        result, calls = self.deploy()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(calls, [])
        self.assertEqual((self.checkout / 'Caddyfile').read_text(), 'custom server configuration\n')

    def test_success_deploys_expected_commit_and_waits_for_health(self):
        result, calls = self.deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(git(self.checkout, 'rev-parse', 'HEAD'), self.expected_sha)
        self.assertIn('build', calls[0])
        self.assertIn('backend', calls[0])
        self.assertIn('frontend', calls[0])
        self.assertIn('up', calls[1])
        self.assertIn('--no-build', calls[1])
        self.assertIn('--wait', calls[1])
        self.assertEqual(calls[2], ['image', 'prune', '-f'])

    def test_build_failure_keeps_running_services_untouched(self):
        result, calls = self.deploy(failure='build')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(calls), 1)
        self.assertIn('build', calls[0])

    def test_unhealthy_services_fail_without_pruning_images(self):
        result, calls = self.deploy(failure='health')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(calls), 2)
        self.assertIn('--wait', calls[-1])

    def test_wrong_commit_stops_before_build(self):
        result, calls = self.deploy(expected_sha='0' * 40)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])

    def test_duplicate_migration_stops_before_build(self):
        migration_dir = self.checkout / 'carehub-backend/src/main/resources/db/migration'
        (migration_dir / 'V1__duplicate.sql').write_text('-- duplicate\n')
        result, calls = self.deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Duplicate Flyway version 1', result.stderr)
        self.assertEqual(calls, [])

    def test_matching_staged_server_fix_accepts_upstream_release(self):
        relative = Path('carehub-backend/src/main/resources/db/migration/V2__search.sql')
        (self.source / relative).write_text('-- matching server fix\n')
        git(self.source, 'add', str(relative))
        git(self.source, 'commit', '-qm', 'Integrate server migration fix')
        git(self.source, 'push', '-q', 'origin', 'production')
        self.expected_sha = git(self.source, 'rev-parse', 'HEAD')
        (self.checkout / relative).write_text('-- matching server fix\n')
        git(self.checkout, 'add', str(relative))

        result, calls = self.deploy()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(git(self.checkout, 'status', '--porcelain'), '')
        self.assertIn('up', calls[1])


if __name__ == '__main__':
    unittest.main()
