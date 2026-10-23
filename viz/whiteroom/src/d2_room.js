// ---------- what God does to the room ----------
// Every hazard is just pressure on his body and mind; what he does about it is still his choice.
function chamberHazards(dtH, sleeping) {
  const I = ITEMS;
  for (const k of ['cold', 'heat', 'flood', 'strobe', 'siren', 'shrink', 'red', 'poison']) if (I[k] > 0) I[k] = Math.max(0, I[k] - dtH);
  I.shrinkK = lerp(I.shrinkK || 0, I.shrink > 0 ? 1 : 0, Math.min(1, dtH * .5));
  if (S.warmth == null) S.warmth = 1;
  if (I.cold > 0) { S.warmth = clamp(S.warmth - .05 * dtH * (sleeping ? .6 : 1)); S.sleep = clamp(S.sleep + .01 * dtH); }
  else S.warmth = clamp(S.warmth + .08 * dtH);
  if (S.warmth < .25) S.health = clamp(Math.max(cfg.chamber.canDie ? 0 : .25, S.health - .01 * dtH));
  if (I.heat > 0) { S.thirst = clamp(S.thirst + .05 * dtH); S.hygiene = clamp(S.hygiene - .01 * dtH); S.anger = clamp(S.anger + .01 * dtH); }
  if (I.flood > 0) { S.hygiene = clamp(S.hygiene - .03 * dtH); S.warmth = clamp(S.warmth - .02 * dtH); if (sleeping) S.sleep = clamp(S.sleep + .1 * dtH); }
  if (I.strobe > 0) { if (sleeping) S.sleep = clamp(S.sleep + .12 * dtH); S.fear = clamp(S.fear + .02 * dtH); }
  if (I.siren > 0) { S.fear = clamp(S.fear + .06 * dtH); if (sleeping) S.sleep = clamp(S.sleep + .14 * dtH); S.anger = clamp(S.anger + .02 * dtH); }
  if (I.shrink > 0) { S.fear = clamp(S.fear + .04 * dtH); S.dread = clamp(S.dread + .02 * dtH); }
  if (I.red > 0) { S.anger = clamp(S.anger + .015 * dtH); S.dread = clamp(S.dread + .01 * dtH); }
  if (I.poison > 0) { S.health = clamp(Math.max(cfg.chamber.canDie ? 0 : .25, S.health - .02 * dtH)); S.disgust = clamp(S.disgust + .05 * dtH); S.hunger = clamp(S.hunger - .02 * dtH); }
  if (I.rat && I.rat.alive) { I.rat.t = (I.rat.t || 0) + dtH; if (I.rat.t > 1) { I.rat.t = 0; I.rat.to = new THREE.Vector3(rnd(-RS + .3, RS - .3), 0, rnd(-RS + .3, RS - .3)); } }
}
let floodMesh = null, frostTint = 0;
function hazardVisuals(now) {
  const I = ITEMS;
  if (I.flood > 0 && !floodMesh) { floodMesh = new THREE.Mesh(new THREE.PlaneGeometry(RS * 2, RS * 2), new THREE.MeshStandardMaterial({ color: 0x6a7a80, roughness: .1, metalness: .2, transparent: true, opacity: .55 })); floodMesh.rotation.x = -Math.PI / 2; floodMesh.position.y = .08; roomGroup.add(floodMesh); }
  if (floodMesh) { floodMesh.visible = I.flood > 0; floodMesh.position.y = .06 + Math.sin(now * .002) * .01; }
  if (I.strobe > 0 && !ROOM.dark) { const on = Math.floor(now / 90) % 2; rLamp.intensity = on ? 1.4 : 0; rHemi.intensity = on ? .9 : .08; }
  if (I.siren > 0) { const p = (Math.sin(now * .012) + 1) / 2; rLamp.color.setRGB(1, .3 + .7 * (1 - p), .3 + .7 * (1 - p)); } else rLamp.color.setRGB(1, 1, 1);
  frostTint = lerp(frostTint, I.cold > 0 ? 1 : 0, .02);
  for (const w of WALLS) { if (I.red > 0) w.mat.color.setRGB(1, .55, .52); else w.mat.color.setRGB(1 - frostTint * .12, 1 - frostTint * .04, 1); }
  if (I.rat && I.rat.mesh && I.rat.alive) {
    const r = I.rat, to = r.to || r.pos, d = to.clone().sub(r.pos); d.y = 0;
    if (d.length() > .05) { d.normalize(); r.pos.addScaledVector(d, .02 * Math.min(Math.max(speed, 1), 3)); r.mesh.rotation.y = Math.atan2(d.x, d.z); animateAnimal(r.a, 1.5, .016, false); } else animateAnimal(r.a, 0, .016, true);
    r.mesh.position.set(r.pos.x * roomGroup.scale.x, 0, r.pos.z * roomGroup.scale.z);
  }
}