import { useState, useEffect } from 'react';
import { Copy, Move } from 'lucide-react';

interface DragIndicatorProps {
  isDragging: boolean;
  isCopyMode: boolean;
}

export const DragIndicator = ({ isDragging, isCopyMode }: DragIndicatorProps) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX + 15, y: e.clientY + 15 });
    };

    const handleDragOver = (e: DragEvent) => {
      setPosition({ x: e.clientX + 15, y: e.clientY + 15 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('dragover', handleDragOver);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, [isDragging]);

  if (!isDragging) return null;

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left: position.x, top: position.y }}
    >
      <div className={`
        flex items-center gap-1.5 px-2 py-1 rounded-md shadow-lg text-xs font-medium
        ${isCopyMode 
          ? 'bg-green-500 text-white' 
          : 'bg-blue-500 text-white'
        }
      `}>
        {isCopyMode ? (
          <>
            <Copy className="h-3 w-3" />
            <span>Copier</span>
          </>
        ) : (
          <>
            <Move className="h-3 w-3" />
            <span>Déplacer</span>
          </>
        )}
      </div>
    </div>
  );
};
