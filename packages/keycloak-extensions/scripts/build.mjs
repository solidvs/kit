// Builds dist/solidvs-keycloak-extensions.jar in a container: the Keycloak extensions of ADR-0018
// (remembered devices for the second factor). Needs Docker only. The laboratory and the platform
// copy the JAR into Keycloak's providers folder.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(join(root, 'dist'), { recursive: true, force: true });
execFileSync('docker', ['build', '--output', `type=local,dest=${join(root, 'dist')}`, root], { stdio: 'inherit' });
