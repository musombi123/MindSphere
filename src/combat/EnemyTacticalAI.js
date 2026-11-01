import * as THREE from 'three';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Deterministic per-enemy state. The slot/sign values remain stable for the
 * encounter so a squad does not flip its flank direction every rethink tick.
 */
export function createEnemyTacticalState(role = 'gangster', boss = false, slot = 0) {
  const index = Math.max(0, Math.floor(Number(slot) || 0));
  return {
    role,
    boss: Boolean(boss),
    slot: index,
    flankSign: index % 2 === 0 ? -1 : 1,
    laneOffset: ((index % 3) - 1) * 1.25,
    suppression: 0,
    evasiveTime: 0,
    rethinkTimer: (index % 4) * 0.12,
    mode: 'advance'
  };
}

/** Apply a short, readable suppression/evasion response when an enemy is hit. */
export function suppressEnemyTactics(enemy, intensity = 0.35) {
  if (!enemy) return;
  const state = enemy.tactical || (enemy.tactical = createEnemyTacticalState(enemy.role, enemy.boss, 0));
  const strength = clamp(Number(intensity) || 0, 0, 1);
  if (state.evasiveTime <= 0 && strength >= 0.22) state.flankSign *= -1;
  state.suppression = clamp(state.suppression + Math.max(0.16, strength * 0.72), 0, 1);
  state.evasiveTime = Math.max(state.evasiveTime, 0.16 + strength * 0.22);
}

/**
 * Evaluate role intent, player rush pressure and ally separation.
 *
 * This is local steering rather than navmesh pathfinding. It keeps combatants
 * from stacking on one point and gives each role a distinct engagement shape.
 */
export function updateEnemyTactics(enemy, squad, player, dt) {
  const state = enemy.tactical || (enemy.tactical = createEnemyTacticalState(enemy.role, enemy.boss, 0));
  const deltaTime = clamp(Number(dt) || 0, 0, 0.1);
  const position = enemy.model.position;
  const target = player.pos;
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const distance = Math.hypot(dx, dz);
  const forward = distance > 0.0001
    ? new THREE.Vector3(dx / distance, 0, dz / distance)
    : new THREE.Vector3(0, 0, 1);
  const lateral = new THREE.Vector3(-forward.z, 0, forward.x).multiplyScalar(state.flankSign);

  state.suppression = Math.max(0, state.suppression - deltaTime * 0.24);
  state.evasiveTime = Math.max(0, state.evasiveTime - deltaTime);
  state.rethinkTimer -= deltaTime;

  const playerVelocity = player.velocity || new THREE.Vector3();
  const closingSpeed = playerVelocity.dot(forward);
  if (distance < 8.5 && closingSpeed > 5.8) {
    state.evasiveTime = Math.max(state.evasiveTime, 0.2);
  }

  if (state.evasiveTime > 0) {
    state.mode = 'evasive';
  } else if (state.rethinkTimer <= 0) {
    const range = Number(enemy.attackRange) || 6;
    if (enemy.boss) {
      state.mode = distance > range + 1.5 ? 'advance' : distance < range - 2 ? 'reposition' : 'command';
    } else if (enemy.role === 'echo') {
      state.mode = distance < range - 3 ? 'retreat' : distance > range + 3 ? 'advance' : 'hold';
    } else if (enemy.role === 'thief') {
      state.mode = distance > range ? 'flank' : 'circle';
    } else {
      state.mode = distance > range ? 'advance' : 'suppress';
    }
    state.rethinkTimer = 0.58 + (state.slot % 4) * 0.09;
  }

  const steering = new THREE.Vector3();
  switch (state.mode) {
    case 'advance':
      steering.copy(forward).addScaledVector(lateral, clamp(state.laneOffset * 0.12, -0.28, 0.28));
      break;
    case 'flank':
      steering.copy(forward).multiplyScalar(0.62).addScaledVector(lateral, 0.78);
      break;
    case 'circle':
      steering.copy(lateral).addScaledVector(forward, 0.12);
      break;
    case 'retreat':
      steering.copy(forward).multiplyScalar(-0.9).addScaledVector(lateral, 0.45);
      break;
    case 'reposition':
      steering.copy(forward).multiplyScalar(-0.42).addScaledVector(lateral, 0.55);
      break;
    case 'command':
      steering.copy(lateral).multiplyScalar(0.45);
      break;
    case 'hold':
      steering.copy(lateral).multiplyScalar(0.62);
      break;
    case 'evasive':
      steering.copy(lateral).multiplyScalar(1.15).addScaledVector(forward, -0.22);
      break;
    default:
      steering.copy(lateral).multiplyScalar(0.32);
      break;
  }

  // Soft personal-space separation prevents the squad collapsing into a pile.
  const separation = new THREE.Vector3();
  for (const ally of squad || []) {
    if (!ally || ally === enemy || ally.dead || !ally.model?.position) continue;
    const away = new THREE.Vector3(
      position.x - ally.model.position.x,
      0,
      position.z - ally.model.position.z
    );
    const allyDistance = away.length();
    if (allyDistance > 0.0001 && allyDistance < 3.4) {
      away.multiplyScalar((3.4 - allyDistance) / (3.4 * allyDistance));
      separation.add(away);
    }
  }
  if (separation.lengthSq() > 0) steering.addScaledVector(separation, 1.05);

  // A player who breaks into melee range forces a small disengagement vector.
  if (distance < 1.65) steering.addScaledVector(forward, -1.1);
  if (state.suppression > 0) {
    steering.addScaledVector(lateral, state.suppression * 0.58);
    steering.addScaledVector(forward, -state.suppression * 0.18);
  }

  const minimumMoveDistance = state.mode === 'retreat' || state.mode === 'reposition' || state.mode === 'evasive'
    ? 0.8
    : 2.2;
  const moving = steering.lengthSq() > 0.014 && distance > minimumMoveDistance;

  return {
    distance,
    mode: state.mode,
    steering,
    moving,
    speedMultiplier: state.mode === 'evasive'
      ? 1.28
      : enemy.role === 'thief' && state.mode === 'flank'
        ? 1.2
        : enemy.boss ? 1.05 : 1,
    accuracyMultiplier: clamp(1 - state.suppression * 0.42, 0.55, 1),
    fireDelayMultiplier: 1 + state.suppression * 0.45
  };
}
