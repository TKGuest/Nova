'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { TableProperties, Columns, Plus, Trash2, LayoutGrid, Table } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

interface DatabaseBlockProps {
  databaseId: string;
}

interface RowData {
  id: string;
  name: string;
  status: 'To Do' | 'In Progress' | 'Done';
  date: string;
  done: boolean;
}

export function DatabaseBlock({ databaseId }: DatabaseBlockProps) {
  const { user } = useAuth();
  const [view, setView] = useState<'table' | 'board'>('table');
  const [rows, setRows] = useState<RowData[]>([]);

  useEffect(() => {
    // Require authenticated user before subscribing
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'databases', databaseId, 'rows'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRows(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as RowData)));
    });
    return () => unsubscribe();
  }, [databaseId, user]);

  const addRow = async () => {
    if (!user) return;
    const newRow: RowData = {
      id: Date.now().toString(),
      name: '',
      status: 'To Do',
      date: new Date().toISOString().split('T')[0],
      done: false
    };

    setRows([...rows, newRow]);
    try {
      await setDoc(doc(db, 'users', user.uid, 'databases', databaseId, 'rows', newRow.id), newRow);
    } catch (e) {
      console.error('Failed to add row:', e);
    }
  };

  const updateRow = async (id: string, updates: Partial<RowData>) => {
    if (!user) return;
    setRows(rows.map(r => r.id === id ? { ...r, ...updates } : r));
    try {
      await updateDoc(doc(db, 'users', user.uid, 'databases', databaseId, 'rows', id), updates);
    } catch (e) {
      console.error('Failed to update row:', e);
    }
  };

  const deleteRow = async (id: string) => {
    if (!user) return;
    setRows(rows.filter(r => r.id !== id));
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'databases', databaseId, 'rows', id));
    } catch (e) {
      console.error('Failed to delete row:', e);
    }
  };

  const statuses: RowData['status'][] = ['To Do', 'In Progress', 'Done'];

  // Show placeholder if not authenticated yet
  if (!user) {
    return (
      <div className="w-full my-4 p-4 border border-border rounded-lg bg-[#1e1e1e] text-gray-500 text-sm">
        Loading database...
      </div>
    );
  }

  return (
    <div className="w-full my-4 p-4 border border-border rounded-lg bg-[#1e1e1e]">
      {/* Header controls */}
      <div className="flex gap-2 mb-4 border-b border-border pb-2">
        <button 
          onClick={() => setView('table')}
          className={`flex items-center gap-1 px-3 py-1 text-sm rounded ${view === 'table' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white hover:bg-hover'}`}
        >
          <Table size={16} /> Table
        </button>
        <button 
          onClick={() => setView('board')}
          className={`flex items-center gap-1 px-3 py-1 text-sm rounded ${view === 'board' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white hover:bg-hover'}`}
        >
          <LayoutGrid size={16} /> Board
        </button>
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-gray-500 uppercase border-b border-border">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium w-16 text-center">Done</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-border hover:bg-hover transition-colors">
                  <td className="px-4 py-2">
                    <input 
                      type="text" 
                      value={row.name}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      className="bg-transparent w-full outline-none focus:border-b focus:border-accent"
                      placeholder="Empty..."
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select 
                      value={row.status}
                      onChange={(e) => updateRow(row.id, { status: e.target.value as any })}
                      className="bg-transparent text-sm p-1 rounded outline-none border border-border focus:border-accent"
                    >
                      <option className="bg-sidebar">To Do</option>
                      <option className="bg-sidebar">In Progress</option>
                      <option className="bg-sidebar">Done</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRow(row.id, { date: e.target.value })}
                      className="bg-transparent outline-none rounded p-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input 
                      type="checkbox"
                      checked={row.done}
                      onChange={(e) => updateRow(row.id, { done: e.target.checked })}
                      className="accent-accent w-4 h-4"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button onClick={() => deleteRow(row.id)} className="text-gray-500 hover:text-red-500 p-1">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button 
            onClick={addRow}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-white mt-3 px-2 py-1"
          >
            <Plus size={16} /> New
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map(statusGroup => (
            <div key={statusGroup} className="flex-1 min-w-[250px] bg-sidebar rounded-md p-3">
              <div className="flex items-center justify-between mb-3 text-sm font-semibold text-gray-400">
                <span className="bg-[#3c3c3c] px-2 py-0.5 rounded text-xs">{statusGroup}</span>
                <span>{rows.filter(r => r.status === statusGroup).length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {rows.filter(r => r.status === statusGroup).map(row => (
                  <div key={row.id} className="bg-background border border-border p-3 rounded-md shadow flex flex-col gap-2">
                    <input 
                      type="text" 
                      value={row.name}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      className="bg-transparent font-medium w-full outline-none text-sm"
                      placeholder="Empty..."
                    />
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <input 
                        type="date"
                        value={row.date}
                        onChange={(e) => updateRow(row.id, { date: e.target.value })}
                        className="bg-transparent outline-none"
                      />
                      <input 
                        type="checkbox"
                        checked={row.done}
                        onChange={(e) => updateRow(row.id, { done: e.target.checked })}
                        className="accent-accent"
                      />
                    </div>
                  </div>
                ))}
                <button 
                  onClick={addRow}
                  className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:bg-hover rounded mt-1 py-1"
                >
                  <Plus size={16} /> New
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
