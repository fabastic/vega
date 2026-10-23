import React, { useRef, useMemo } from 'react';
import { Billboard, Text, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../store/useSimulationStore';
import { ASSET_REGISTRY } from '../assets/registry';

interface Props {
  id: string;
  x: number;
  z: number;
  visualProfile: string;
  currentAction: string;
  isMigrating: boolean;
  chatBubble?: string;
}

// Action → visual indicator
const ACTION_EMOJI: Record<string, string> = {
  eat: '🍽',
  talk: '💬',
  cooperate_share: '🤝',
  rest: '💤',
  sleep: '💤',
  mine: '⛏',
  farm: '🌾',
  craft: '🔨',
  trade: '💰',
  migrate: '🚶',
  gather: '🌿',
};

const ACTION_COLOR: Record<string, string> = {
  work: '#fbbf24',
  farm: '#34d399',
  gather: '#34d399',
  mine: '#94a3b8',
  craft: '#f97316',
  eat: '#f59e0b',
  trade: '#a78bfa',
  migrate: '#818cf8',
  rest: '#6b7280',
  sleep: '#6b7280',
  idle: '#475569',
};

const ModelRenderer: React.FC<{ modelPath: string }> = ({ modelPath }) => {
  const { scene } = useGLTF(modelPath);
  const clone = useMemo(() => scene.clone(), [scene]);
  return <primitive object={clone} scale={[1, 1, 1]} />;
};

export const SpriteBillboard: React.FC<Props> = ({ id, x, z, visualProfile, currentAction, isMigrating, chatBubble }) => {
  const selectAgent = useSimulationStore((state) => state.setSelectedAgentId);
  const selectedAgentId = useSimulationStore((state) => state.selectedAgentId);
  const isSelected = selectedAgentId === id;

  const modelPath = (ASSET_REGISTRY.agents as any)[visualProfile] || ASSET_REGISTRY.agents.default;
  const rootGroupRef = useRef<THREE.Group>(null);
  const agentGroupRef = useRef<THREE.Group>(null);
  const prevPosRef = useRef({ x, z });
  const currentRotYRef = useRef(0);
  const targetRotYRef = useRef(0);

  React.useEffect(() => {
    if (rootGroupRef.current) {
      rootGroupRef.current.position.set(x, 0, z);
    }
  }, []);

  useFrame((state, delta) => {
    if (!agentGroupRef.current || !rootGroupRef.current) return;

    // Smooth position interpolation (prevents teleporting between ticks)
    const lerpFactor = Math.min(1, delta * 6);
    rootGroupRef.current.position.x = THREE.MathUtils.lerp(rootGroupRef.current.position.x, x, lerpFactor);
    rootGroupRef.current.position.z = THREE.MathUtils.lerp(rootGroupRef.current.position.z, z, lerpFactor);

    // Smooth rotation: calculate facing direction from movement delta
    const dx = x - prevPosRef.current.x;
    const dz = z - prevPosRef.current.z;
    if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) {
      targetRotYRef.current = Math.atan2(dx, dz);
      prevPosRef.current = { x, z };
    }

    // Slerp rotation to prevent snapping
    const angleDiff = ((targetRotYRef.current - currentRotYRef.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    currentRotYRef.current += angleDiff * Math.min(1, delta * 8);
    agentGroupRef.current.rotation.y = currentRotYRef.current;

    // Action-based animation - tied to simulation action state, not random
    const time = state.clock.getElapsedTime();
    const action = isMigrating ? 'migrate' : currentAction;
    if (action === 'work' || action === 'farm' || action === 'gather' || action === 'mine') {
      agentGroupRef.current.position.y = 0.5 + Math.sin(time * 6) * 0.08;
    } else if (action === 'rest' || action === 'sleep') {
      agentGroupRef.current.position.y = 0.3;
    } else if (action === 'migrate') {
      // Slight bounce when walking
      agentGroupRef.current.position.y = 0.5 + Math.abs(Math.sin(time * 5)) * 0.1;
    } else {
      agentGroupRef.current.position.y = 0.5;
    }
  });

  const actionColor = ACTION_COLOR[currentAction] || '#94a3b8';
  const actionEmoji = isMigrating ? '🚶' : ACTION_EMOJI[currentAction];

  return (
    <group ref={rootGroupRef}>
      {/* Agent model */}
      <group ref={agentGroupRef} onClick={(e) => { e.stopPropagation(); selectAgent(id); }} position={[0, 0.5, 0]}>
        <React.Suspense fallback={
          <mesh>
            <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
            <meshStandardMaterial color={isSelected ? '#22d3ee' : actionColor} roughness={0.6} />
          </mesh>
        }>
          <ModelRenderer modelPath={modelPath} />
        </React.Suspense>
      </group>

      {/* Selected agent: ring + arrow */}
      {isSelected && (
        <>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 0.85, 24]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} />
          </mesh>
        </>
      )}

      {/* Agent billboard indicators */}
      <Billboard position={[0, 2.5, 0]} follow lockX lockY lockZ={false}>
        {isSelected && (
          <mesh position={[0, 0.35, 0]}>
            <coneGeometry args={[0.12, 0.22, 3]} />
            <meshBasicMaterial color="#22d3ee" />
          </mesh>
        )}

        {/* Action indicator */}
        {actionEmoji && (
          <Text position={[0, 0.0, 0]} fontSize={0.28} color={actionColor} anchorX="center" anchorY="middle">
            {actionEmoji}
          </Text>
        )}

        {/* Chat bubble */}
        {chatBubble && (
          <group position={[0, 0.6, 0]}>
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[1.6, 0.42]} />
              <meshBasicMaterial color="#f0f0e8" />
            </mesh>
            <Text position={[0, 0, 0.01]} fontSize={0.18} color="#1c1410" anchorX="center" anchorY="middle" maxWidth={1.5}>
              {chatBubble}
            </Text>
          </group>
        )}
      </Billboard>
    </group>
  );
};