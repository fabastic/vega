import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';

export const Environment: React.FC = () => {
  const buildings = useSimulationStore((state) => state.buildings);

  return (
    <group>
      {buildings.map((b) => {
        const [w, h, d] = b.scale || [3, 3, 3];
        return (
          <group key={b.id} position={[b.x, 0, b.y]}>
            {/* Building Body */}
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color="#4b5563" />
            </mesh>

            {/* Red Cross Sign for Hospital */}
            {b.building_type === 'institution' && (
              <mesh position={[0, h + 0.5, d / 2 + 0.1]}>
                <boxGeometry args={[1, 1, 0.2]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            )}

            {/* Roof for Houses */}
            {b.building_type === 'house' && (
              <mesh position={[0, h + 0.8, 0]} rotation={[0, Math.PI / 4, 0]}>
                <coneGeometry args={[w * 0.8, 1.6, 4]} />
                <meshStandardMaterial color="#b91c1c" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
};