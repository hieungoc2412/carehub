"""Reject duplicate Flyway SQL migration versions before building a release."""
from pathlib import Path
import re
import sys


def check_migrations(directory):
    versions = {}
    for path in sorted(Path(directory).glob('V*__*.sql')):
        match = re.fullmatch(r'V(\d+(?:[._]\d+)*)__.+\.sql', path.name)
        if not match:
            continue
        version = tuple(int(part) for part in re.split(r'[._]', match[1]))
        while len(version) > 1 and version[-1] == 0:
            version = version[:-1]
        if version in versions:
            number = '.'.join(map(str, version))
            raise ValueError(f'Duplicate Flyway version {number}: {versions[version]} and {path.name}')
        versions[version] = path.name
    if not versions:
        raise ValueError(f'No versioned SQL migrations found in {directory}')
    return len(versions)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 scripts/check_flyway_migrations.py MIGRATION_DIRECTORY')
    try:
        count = check_migrations(sys.argv[1])
    except ValueError as error:
        sys.exit(str(error))
    print(f'Flyway migration versions: OK ({count} migrations)')
