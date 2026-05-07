import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Trash2 } from 'lucide-react';

export default function ToggleNodeView({ node, updateAttributes, deleteNode }: any) {
  const isOpen = node.attrs.isOpen;
  const [isHovered, setIsHovered] = useState(false);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateAttributes({ isOpen: !isOpen });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNode();
  };

  return (
    <NodeViewWrapper 
      className={`toggle-list ${isOpen ? 'is-open' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="toggle-icon-container">
        <span 
          className="toggle-icon" 
          onClick={toggle}
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▶
        </span>
      </div>
      <div className="toggle-wrapper">
        <NodeViewContent className="toggle-content-hole" />
      </div>
      
      {isHovered && (
        <button 
          onClick={handleDelete}
          className="absolute right-0 top-0 p-1 text-gray-500 hover:text-red-400 bg-[#1e1e1e] rounded"
          title="Delete Toggle"
        >
          <Trash2 size={14} />
        </button>
      )}
    </NodeViewWrapper>
  );
}
