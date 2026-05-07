import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Type, List, ListOrdered, CheckSquare, Play } from 'lucide-react';

export const CommandsList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  useEffect(() => setSelectedIndex(0), [props.items]);

  return (
    <div className="bg-[#252526] border border-[#3e3e3e] rounded-lg shadow-2xl overflow-hidden min-w-[200px] p-1">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            key={index}
            onClick={() => selectItem(index)}
            className={`flex items-center gap-3 w-full px-3 py-2 text-sm rounded transition-colors ${
              index === selectedIndex ? 'bg-[#37373d] text-white' : 'text-gray-300 hover:bg-[#2d2d2d]'
            }`}
          >
            <div className="text-gray-500">
              {item.title === 'Text' && <Type size={16} />}
              {item.title === 'Bulleted List' && <List size={16} />}
              {item.title === 'Numbered List' && <ListOrdered size={16} />}
              {item.title === 'To-do List' && <CheckSquare size={16} />}
              {item.title === 'Toggle List' && <Play size={12} className="fill-current rotate-90" />}
            </div>
            {item.title}
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-gray-500">No results</div>
      )}
    </div>
  );
});

CommandsList.displayName = 'CommandsList';
