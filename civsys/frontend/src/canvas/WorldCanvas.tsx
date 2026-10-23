import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { TerrainGrid } from './TerrainGrid';
import { SpriteBillboard } from './SpriteBillboard';
import { useSimulationStore } from '../store/useSimulationStore';
import * as THREE from 'three';

const FreeFlyCameraController = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.code === 'Space') keys.current['space'] = true;
      if (e.key === 'Shift') keys.current['shift'] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
      if (e.code === 'Space') keys.current['space'] = false;
      if (e.key === 'Shift') keys.current['shift'] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    const speed = 30 * delta;
    const target = controlsRef.current.target;
    const camera = controlsRef.current.object;

    const moveX = (keys.current['d'] ? 1 : 0) - (keys.current['a'] ? 1 : 0);
    const moveZ = (keys.current['s'] ? 1 : 0) - (keys.current['w'] ? 1 : 0);
    const moveY = (keys.current['space'] ? 1 : 0) - (keys.current['shift'] ? 1 : 0);

    if (moveX !== 0 || moveZ !== 0 || moveY !== 0) {
      target.x += moveX * speed;
      target.z += moveZ * speed;
      target.y += moveY * speed;
      camera.position.x += moveX * speed;
      camera.position.z += moveZ * speed;
      camera.position.y += moveY * speed;
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableRotate={true}
      enablePan={true}
      enableZoom={true}
      minPolarAngle={Math.PI / 8}    // Can't go under the ground
      maxPolarAngle={Math.PI / 2.5}   // Octopath-style: limited vertical range
      minDistance={10}
      maxDistance={140}
      target={[0, 0, 0]}
    />
  );
};

export const WorldCanvas = () => {
  const agents = useSimulationStore((state) => state.agents);
  const selectAgent = useSimulationStore((state) => state.setSelectedAgentId);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#0a0614', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 32, 42], fov: 36 }}
        shadows
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) selectAgent(null);
        }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
      >
        {/* Atmospheric lighting — warm civilization afternoon */}
        <ambientLight intensity={0.7} color="#c9d6e3" />
        <directionalLight 
          position={[50, 80, 30]} 
          intensity={1.6} 
          color="#fff7e8"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={400}
          shadow-camera-left={-150}
          shadow-camera-right={150}
          shadow-camera-top={150}
          shadow-camera-bottom={-150}
        />
        {/* Subtle fill light from below-horizon */}
        <directionalLight position={[-30, 5, -60]} intensity={0.3} color="#87ceeb" />

        {/* Atmospheric sky */}
        <Sky
          distance={450000}
          sunPosition={[50, 80, 30]}
          inclination={0}
          azimuth={0.25}
          turbidity={8}
          rayleigh={1}
        />

        <TerrainGrid />
        <FreeFlyCameraController />

        {/* Agents - only render up to 500 for performance */}
        {agents.slice(0, 500).map((agent) => (
          <SpriteBillboard
            key={agent.id}
            id={agent.id}
            x={agent.x}
            z={agent.y}
            visualProfile={agent.visual_profile}
            currentAction={agent.current_action}
            isMigrating={agent.is_migrating}
            chatBubble={agent.chat_bubble}
          />
        ))}

      </Canvas>
      {/* Agent count overlay */}
      {agents.length > 500 && (
        <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 2 }}>
          Showing 500/{agents.length} agents
        </div>
      )}
    </div>
  );
};