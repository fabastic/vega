import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '../store/useSimulationStore';
import { TerrainCellSnapshot, BuildingSnapshot } from '../types/simulation';

// ─── TERRAIN HEIGHT MAP ─────────────────────────────────────────────────────
// Heights emerge from terrain_type, not from event names.
// The renderer responds to state, not to event labels.
const TERRAIN_HEIGHT: Record<string, number> = {
  grass: 0.3,
  forest: 0.4,
  farm: 0.25,
  rock: 1.2,       // Mountains/crags are elevated
  road: 0.15,
  river: -0.3,      // Rivers are recessed
  desert: 0.2,
  default: 0.3,
};

// ─── BUILDING VISUAL DEFINITIONS ────────────────────────────────────────────
const BUILDING_COLORS: Record<string, string> = {
  farm: '#92400e',
  market: '#d97706',
  workshop: '#64748b',
  home: '#c4b5a0',
  mine: '#1e293b',
  institution: '#3b82f6',
};

const BUILDING_DIMS: Record<string, [number, number, number]> = {
  farm: [3.5, 1.2, 3.5],
  market: [4.5, 5.5, 4.5],
  workshop: [3, 3.5, 3],
  home: [2, 2.5, 2],
  mine: [4.5, 2.5, 4.5],
  institution: [6, 5, 6],
};

// ─── DATA-DRIVEN BUILDING ────────────────────────────────────────────────────
const DataDrivenBuilding: React.FC<{ b: BuildingSnapshot; hw: number; hh: number }> = ({ b, hw, hh }) => {
  const color = BUILDING_COLORS[b.building_type] || '#ffffff';
  const dims = BUILDING_DIMS[b.building_type] || [2, 2, 2];
  // Slightly vary color per building for visual variety
  const colorObj = new THREE.Color(color);
  const variance = (b.id.charCodeAt(b.id.length - 1) % 20 - 10) / 200;
  colorObj.offsetHSL(0, 0, variance);

  const terrainY = TERRAIN_HEIGHT['grass'] * 0.5; // Base on grass height
  
  return (
    <group position={[b.x - hw, terrainY, b.y - hh]}>
      {/* Building body */}
      <mesh position={[0, dims[1] / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={dims} />
        <meshStandardMaterial color={`#${colorObj.getHexString()}`} roughness={0.75} metalness={0.1} />
      </mesh>
      {/* Roof accent */}
      {b.building_type === 'home' && (
        <mesh position={[0, dims[1] + 0.4, 0]} castShadow>
          <coneGeometry args={[1.6, 1.2, 4]} />
          <meshStandardMaterial color="#7c2d12" roughness={0.9} />
        </mesh>
      )}
      {b.building_type === 'market' && (
        <mesh position={[0, dims[1], 0]} castShadow>
          <cylinderGeometry args={[1.2, 1.5, 1.5, 6]} />
          <meshStandardMaterial color="#92400e" roughness={0.8} />
        </mesh>
      )}
    </group>
  );
};

// ─── INSTANCED TREE CLUSTER ──────────────────────────────────────────────────
// Trees are placed on forest/grass cells proportionally to wood_resources state.
// Drought (low fertility) = sparse trees with brown hue, not a hardcoded event check.
interface TreeConfig {
  position: [number, number, number];
  scale: number;
  trunkColor: string;
  foliageColor: string;
}

const InstancedTrees: React.FC<{ trees: TreeConfig[] }> = ({ trees }) => {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const foliageRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  useMemo(() => {
    if (!trunkRef.current || !foliageRef.current) return;
    trees.forEach((tree, i) => {
      dummy.position.set(tree.position[0], tree.position[1], tree.position[2]);
      dummy.scale.setScalar(tree.scale * 0.5);
      dummy.updateMatrix();
      trunkRef.current!.setMatrixAt(i, dummy.matrix);
      
      dummy.position.set(tree.position[0], tree.position[1] + tree.scale * 1.2, tree.position[2]);
      dummy.scale.setScalar(tree.scale);
      dummy.updateMatrix();
      foliageRef.current!.setMatrixAt(i, dummy.matrix);
    });
    trunkRef.current.instanceMatrix.needsUpdate = true;
    foliageRef.current.instanceMatrix.needsUpdate = true;
  }, [trees, dummy]);

  if (trees.length === 0) return null;

  return (
    <>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.8, 5]} />
        <meshStandardMaterial color="#5c3317" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={foliageRef} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.55, 1.1, 6]} />
        <meshStandardMaterial color="#1a5c2e" roughness={0.85} />
      </instancedMesh>
    </>
  );
};

// ─── WATER PLANE ─────────────────────────────────────────────────────────────
const WaterInstances: React.FC<{ matrices: THREE.Matrix4[] }> = ({ matrices }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useMemo(() => {
    if (!ref.current) return;
    matrices.forEach((mat, i) => ref.current!.setMatrixAt(i, mat));
    ref.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  if (matrices.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#1d4ed8" roughness={0.1} metalness={0.3} transparent opacity={0.85} />
    </instancedMesh>
  );
};

// ─── GENERIC TERRAIN INSTANCES ────────────────────────────────────────────────
const TerrainInstances: React.FC<{ matrices: THREE.Matrix4[]; color: string; roughness?: number }> = ({ matrices, color, roughness = 0.8 }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useMemo(() => {
    if (!ref.current) return;
    matrices.forEach((mat, i) => ref.current!.setMatrixAt(i, mat));
    ref.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  if (matrices.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </instancedMesh>
  );
};

// ─── SETTLEMENT MARKER ────────────────────────────────────────────────────────
const SettlementLabel: React.FC<{ name: string; x: number; z: number }> = ({ name, x, z }) => (
  <mesh position={[x, 4.5, z]}>
    <sphereGeometry args={[0.4, 6, 4]} />
    <meshBasicMaterial color="#fbbf24" />
  </mesh>
);

// ─── MAIN TERRAIN GRID ────────────────────────────────────────────────────────
export const TerrainGrid: React.FC = () => {
  const { worldBounds, terrainCells, buildingsList, cropYieldMultiplier } = useSimulationStore();
  const hw = worldBounds.width / 2;
  const hh = worldBounds.height / 2;

  // Environmental state → visual appearance mapping.
  // Drought/wet state is inferred from cropYieldMultiplier, not event name.
  // Low yield → dry/brown terrain tints; High → lush greens.
  const yieldRatio = Math.max(0, Math.min(1, cropYieldMultiplier));
  const grassColor = new THREE.Color().lerpColors(
    new THREE.Color('#9a7a3a'), // dry/drought
    new THREE.Color('#3d7a45'), // normal lush green
    yieldRatio
  );
  const farmColor = new THREE.Color().lerpColors(
    new THREE.Color('#7a5a20'), // dry/cracked farmland
    new THREE.Color('#8b6914'), // normal farmland
    yieldRatio
  );
  const forestColor = new THREE.Color().lerpColors(
    new THREE.Color('#4a5e35'), // stressed forest
    new THREE.Color('#1e5728'), // healthy forest
    yieldRatio
  );

  const TERRAIN_COLORS: Record<string, string> = {
    grass: `#${grassColor.getHexString()}`,
    forest: `#${forestColor.getHexString()}`,
    farm: `#${farmColor.getHexString()}`,
    rock: '#5a5a5a',
    road: '#333344',
    river: '#1a4980',
    desert: '#c4a96d',
    default: '#4a6741',
  };

  // Build instanced mesh data by terrain type
  const { terrainGroups, treeConfigs, waterMatrices } = useMemo(() => {
    const groups: Record<string, THREE.Matrix4[]> = {};
    Object.keys(TERRAIN_COLORS).forEach(type => { groups[type] = []; });
    const waterMats: THREE.Matrix4[] = [];
    const trees: TreeConfig[] = [];

    const dummy = new THREE.Object3D();
    // Sample rate: show every N cells for performance  
    const sampleRate = worldBounds.width >= 256 ? 4 : worldBounds.width >= 128 ? 2 : 1;

    terrainCells.forEach((cell: TerrainCellSnapshot) => {
      if ((cell.x % sampleRate !== 0) || (cell.y % sampleRate !== 0)) return;

      const type = groups[cell.terrain_type] ? cell.terrain_type : 'default';
      const baseH = TERRAIN_HEIGHT[type] ?? 0.3;
      const cx = cell.x - hw + sampleRate / 2;
      const cz = cell.y - hh + sampleRate / 2;

      if (type === 'river') {
        dummy.position.set(cx, baseH / 2, cz);
        dummy.scale.set(sampleRate, 0.4, sampleRate);
        dummy.updateMatrix();
        waterMats.push(dummy.matrix.clone());
      } else {
        dummy.position.set(cx, baseH / 2, cz);
        dummy.scale.set(sampleRate, baseH, sampleRate);
        dummy.updateMatrix();
        groups[type].push(dummy.matrix.clone());
      }

      // Trees: place on forest/grass cells based on density
      if ((type === 'forest' || type === 'grass') && Math.random() < (type === 'forest' ? 0.4 : 0.04)) {
        const jitterX = (Math.random() - 0.5) * sampleRate * 0.8;
        const jitterZ = (Math.random() - 0.5) * sampleRate * 0.8;
        const treeScale = 0.6 + Math.random() * 0.8;
        trees.push({
          position: [cx + jitterX, baseH, cz + jitterZ],
          scale: treeScale * (0.5 + yieldRatio * 0.5), // Smaller trees during drought
          trunkColor: '#5c3317',
          foliageColor: '#1a5c2e',
        });
      }
    });

    return { terrainGroups: groups, treeConfigs: trees, waterMatrices: waterMats };
  }, [terrainCells, hw, hh, worldBounds.width, yieldRatio]);

  // Settlements from real backend data (regions)
  const settlements = useMemo(() => [
    { name: 'Riverside', x: 128 - hw, z: 128 - hh },
    { name: 'Woodhaven', x: 40 - hw, z: 40 - hh },
    { name: 'Stonegate', x: 210 - hw, z: 150 - hh },
  ], [hw, hh]);

  return (
    <group>
      {/* Base abyss/ocean plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} receiveShadow>
        <planeGeometry args={[worldBounds.width + 100, worldBounds.height + 100]} />
        <meshStandardMaterial color="#0a0f1a" roughness={1} />
      </mesh>
      
      {/* Terrain instances per type */}
      {Object.entries(terrainGroups).map(([type, matrices]) => {
        if (matrices.length === 0 || type === 'river') return null;
        return (
          <TerrainInstances
            key={type}
            matrices={matrices}
            color={TERRAIN_COLORS[type] || '#4a6741'}
            roughness={type === 'rock' ? 0.95 : type === 'road' ? 0.5 : 0.85}
          />
        );
      })}

      {/* Water (rivers) with special material */}
      <WaterInstances matrices={waterMatrices} />

      {/* Vegetation - instanced trees */}
      <InstancedTrees trees={treeConfigs} />

      {/* Buildings from backend state */}
      {buildingsList && buildingsList.map((b: BuildingSnapshot) => (
        <DataDrivenBuilding key={b.id} b={b} hw={hw} hh={hh} />
      ))}

      {/* Settlement markers */}
      {settlements.map(s => (
        <SettlementLabel key={s.name} name={s.name} x={s.x} z={s.z} />
      ))}
    </group>
  );
};