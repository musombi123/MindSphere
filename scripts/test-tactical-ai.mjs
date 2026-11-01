import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createEnemyTacticalState,
  suppressEnemyTactics,
  updateEnemyTactics
} from '../src/combat/EnemyTacticalAI.js';

function makeEnemy(role, slot, x, z, boss = false) {
  return {
    role,
    boss,
    dead: false,
    attackRange: boss ? 9.5 : role === 'echo' ? 13.5 : role === 'thief' ? 7.5 : 5.8,
    model: { position: new THREE.Vector3(x, 0, z) },
    tactical: createEnemyTacticalState(role, boss, slot)
  };
}

const player = {
  pos: new THREE.Vector3(0, 0, -4),
  velocity: new THREE.Vector3()
};

const raider = makeEnemy('gangster', 0, 0, -14);
const thief = makeEnemy('thief', 1, 2, -16);
const echo = makeEnemy('echo', 2, -2, -18);
const commander = makeEnemy('gangster', 3, 0, -22, true);
const squad = [raider, thief, echo, commander];

assert.equal(raider.tactical.flankSign, -1);
assert.equal(thief.tactical.flankSign, 1);
assert.ok(Math.abs(raider.tactical.laneOffset) <= 1.25);

for (const enemy of squad) {
  const result = updateEnemyTactics(enemy, squad, player, 1 / 60);
  assert.ok(Number.isFinite(result.distance));
  assert.ok(Number.isFinite(result.steering.x));
  assert.ok(Number.isFinite(result.steering.z));
  assert.ok(result.speedMultiplier >= 1);
  assert.ok(result.accuracyMultiplier <= 1 && result.accuracyMultiplier > 0);
}

const beforeAccuracy = updateEnemyTactics(raider, squad, player, 1 / 60).accuracyMultiplier;
suppressEnemyTactics(raider, 0.8);
const suppressed = updateEnemyTactics(raider, squad, player, 1 / 60);
assert.ok(raider.tactical.suppression > 0);
assert.ok(raider.tactical.evasiveTime > 0);
assert.ok(suppressed.accuracyMultiplier < beforeAccuracy);
assert.ok(suppressed.fireDelayMultiplier > 1);
assert.ok(suppressed.mode === 'evasive');

player.velocity.set(9, 0, 0);
player.pos.set(4, 0, -14);
const rushingTarget = makeEnemy('gangster', 4, 0, -14);
const rushResponse = updateEnemyTactics(rushingTarget, [rushingTarget], player, 1 / 60);
assert.equal(rushResponse.mode, 'evasive');
assert.ok(rushResponse.speedMultiplier > 1);

const overlapA = makeEnemy('gangster', 5, 1, 1);
const overlapB = makeEnemy('gangster', 6, 1, 1);
const overlapResult = updateEnemyTactics(overlapA, [overlapA, overlapB], {
  pos: new THREE.Vector3(10, 0, 1),
  velocity: new THREE.Vector3()
}, 1 / 60);
assert.ok(Number.isFinite(overlapResult.steering.length()));

const decayStart = raider.tactical.suppression;
updateEnemyTactics(raider, squad, player, 0.1);
assert.ok(raider.tactical.suppression < decayStart);

console.log('[Project Zero Hour] Tactical AI tests passed: role steering, squad spacing, suppression, and rush response.');
