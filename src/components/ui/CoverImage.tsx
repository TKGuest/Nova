'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Upload, Link as LinkIcon, X, Loader2, Move } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '@/lib/firebase';
import { doc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { deleteObject } from 'firebase/storage';
import { useAuth } from '@/components/auth/AuthProvider';
import { useNotification } from '@/context/NotificationContext';

const PRESET_COVERS = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1434725039720-abb26e22ebe5?auto=format&fit=crop&q=80',
];

interface CoverImageProps {
  pageId: string;
  recordId?: string; 
  isDefault?: boolean; // Add this
  coverImage?: {
    url: string;
    type: 'preset' | 'upload';
    position?: number;
  };
  editable?: boolean;
}

export function CoverImage({ pageId, recordId, isDefault, coverImage, editable = true }: CoverImageProps) {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [optimisticCover, setOptimisticCover] = useState<string | null>(null);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [tempPosition, setTempPosition] = useState(coverImage?.position || 50);
  const [userCovers, setUserCovers] = useState<{ id: string, url: string, storagePath: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Sync tempPosition with incoming coverImage prop
  useEffect(() => {
    if (coverImage?.position !== undefined && !isRepositioning) {
      setTempPosition(coverImage.position);
    }
  }, [coverImage?.position, isRepositioning]);

  // Listen for user's saved covers
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'saved_covers'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setUserCovers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
  }, [user]);

  // Clear optimistic cover only when the prop matches it
  useEffect(() => {
    if (coverImage?.url && coverImage.url === optimisticCover) {
      setOptimisticCover(null);
    }
  }, [coverImage?.url, optimisticCover]);

  const getOptimizedUrl = (url?: string, type?: string, width: number = 2000) => {
    if (!url) return '';
    if (type !== 'preset') return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}w=${width}`;
  };

  const updateCover = async (url: string, type: 'preset' | 'upload', position: number = 50) => {
    if (!user) return;
    setOptimisticCover(url); 
    try {
      const field = isDefault ? 'defaultRecordCover' : 'coverImage';
      const docPath = recordId 
        ? doc(db, 'users', user.uid, 'pages', pageId, 'records', recordId)
        : doc(db, 'users', user.uid, 'pages', pageId);
        
      await updateDoc(docPath, {
        [field]: { url, type, position }
      });
      showToast(isDefault ? 'Default cover updated' : 'Cover updated');
      setIsOpen(false);
    } catch (error) {
      console.error('Update cover error:', error);
      setOptimisticCover(null);
      showToast('Failed to save to database', 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file size (limit to 5MB for fast local dev)
    if (file.size > 5 * 1024 * 1024) {
      showToast('File too large (max 5MB)', 'error');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setOptimisticCover(localUrl);
    setIsUploading(true);
    setIsOpen(false);
    showToast('Starting upload...');

    try {
      const storagePath = `users/${user.uid}/covers/${pageId}_${Date.now()}`;
      const storageRef = ref(storage, storagePath);
      console.log('Attempting upload to:', storageRef.fullPath);
      
      const uploadResult = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      // Save to user's gallery
      await addDoc(collection(db, 'users', user.uid, 'saved_covers'), {
        url,
        storagePath,
        createdAt: Date.now()
      });

      await updateCover(url, 'upload');
    } catch (error: any) {
      console.error('Firebase Storage Error:', error);
      setOptimisticCover(null);
      if (error.code === 'storage/unauthorized') {
        showToast('Storage Permission Denied', 'error');
      } else if (error.code === 'storage/retry-limit-exceeded') {
        showToast('Connection timed out (Check CORS settings)', 'error');
      } else {
        showToast('Upload failed: ' + (error.message || 'Unknown error'), 'error');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removeCover = async () => {
    if (!user) return;
    try {
      const field = isDefault ? 'defaultRecordCover' : 'coverImage';
      const docPath = recordId 
        ? doc(db, 'users', user.uid, 'pages', pageId, 'records', recordId)
        : doc(db, 'users', user.uid, 'pages', pageId);

      await updateDoc(docPath, {
        [field]: null
      });
      showToast(isDefault ? 'Default cover removed' : 'Cover removed');
    } catch (error) {}
  };

  const deleteUserCover = async (e: React.MouseEvent, cover: any) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'saved_covers', cover.id));
      const storageRef = ref(storage, cover.storagePath);
      await deleteObject(storageRef);
      showToast('Image deleted from gallery');
    } catch (error) {
      showToast('Failed to delete image', 'error');
    }
  };

  const startReposition = () => {
    setIsRepositioning(true);
    setDragY(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isRepositioning) return;
    setDragY(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isRepositioning || dragY === 0) return;
    const deltaY = e.clientY - dragY;
    const movementPercent = (deltaY / (imageContainerRef.current?.clientHeight || 200)) * 100;
    
    setTempPosition(prev => {
      const next = prev - movementPercent;
      return Math.min(Math.max(next, 0), 100);
    });
    setDragY(e.clientY);
  };

  const handleMouseUp = () => {
    setDragY(0);
  };

  const saveReposition = async () => {
    if (!user || !coverImage) return;
    try {
      const field = isDefault ? 'defaultRecordCover' : 'coverImage';
      const docPath = recordId 
        ? doc(db, 'users', user.uid, 'pages', pageId, 'records', recordId)
        : doc(db, 'users', user.uid, 'pages', pageId);
        
      await updateDoc(docPath, {
        [`${field}.position`]: tempPosition
      });
      setIsRepositioning(false);
      showToast('Position saved');
    } catch (error) {
      showToast('Failed to save position', 'error');
    }
  };

  const [urlInput, setUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'link'>('presets');

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      updateCover(urlInput.trim(), 'preset');
      setUrlInput('');
    }
  };

  return (
    <div 
      ref={imageContainerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative group/cover w-full h-48 md:h-64 bg-[#111] overflow-hidden ${isRepositioning ? 'cursor-ns-resize select-none' : ''}`}
    >
      {(coverImage || optimisticCover) ? (
        <>
          <img 
            src={optimisticCover ? optimisticCover : getOptimizedUrl(coverImage?.url, coverImage?.type, 2000)} 
            className={`w-full h-full object-cover transition-all ${isRepositioning ? 'duration-0' : 'duration-700'} ${isUploading ? 'opacity-70 blur-[2px]' : 'opacity-100'}`} 
            style={{ objectPosition: `50% ${tempPosition}%` }}
            onLoad={(e) => (e.target as HTMLImageElement).classList.remove('opacity-0')}
            onError={() => {
              showToast('Failed to load image link', 'error');
              setOptimisticCover(null);
            }}
            alt="Page cover" 
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
              <div className="bg-black/60 px-4 py-2 rounded-full flex items-center gap-3 border border-white/10">
                <Loader2 className="animate-spin text-blue-400" size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Uploading...</span>
              </div>
            </div>
          )}
          {isRepositioning && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-4 pointer-events-none">
              <div className="bg-black/80 px-4 py-2 rounded-full flex items-center gap-3 border border-white/10 backdrop-blur-md">
                <Move size={16} className="text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Drag to Reposition</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); saveReposition(); }}
                className="pointer-events-auto px-8 py-3 bg-blue-500 text-white rounded-full text-[12px] font-black uppercase tracking-widest hover:bg-blue-600 shadow-xl shadow-blue-500/20"
              >
                Save Position
              </button>
            </div>
          )}
          {!isRepositioning && editable && !isUploading && (
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-end justify-end p-4 gap-2">
              <button 
                onClick={() => startReposition()}
                className="px-5 py-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-md text-[12px] font-black uppercase tracking-widest text-white hover:bg-black/80 transition-all flex items-center gap-2"
              >
                <Move size={16}/> Reposition
              </button>
              <button 
                onClick={() => setIsOpen(!isOpen)}
                className="px-5 py-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-md text-[12px] font-black uppercase tracking-widest text-white hover:bg-black/80 transition-all"
              >
                Change Cover
              </button>
              <button 
                onClick={removeCover}
                className="px-5 py-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-md text-[12px] font-black uppercase tracking-widest text-white hover:bg-black/80 transition-all"
              >
                Remove
              </button>
            </div>
          )}
        </>
      ) : (
        editable && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
            <button 
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-lg text-[13px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <ImageIcon size={18} /> Add Cover
            </button>
          </div>
        )
      )}

      {isOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
             <div className="flex gap-4">
               <button onClick={() => setActiveTab('presets')} className={`text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'presets' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>Gallery</button>
               <button onClick={() => setActiveTab('upload')} className={`text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'upload' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>Upload</button>
               <button onClick={() => setActiveTab('link')} className={`text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'link' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>Link</button>
             </div>
            <button onClick={() => setIsOpen(false)} className="p-1 text-gray-500 hover:text-white transition-colors"><X size={16}/></button>
          </div>

          <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
            {activeTab === 'presets' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 block px-1">Library</span>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_COVERS.map((url, i) => (
                      <button 
                        key={i} 
                        onClick={() => updateCover(url, 'preset')}
                        className="aspect-video rounded-lg overflow-hidden border border-transparent hover:border-blue-500/50 transition-all group/preset relative"
                      >
                        <img src={url + '&w=400'} className="w-full h-full object-cover" alt="" />
                        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover/preset:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>

                {userCovers.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 block px-1">Your Images</span>
                    <div className="grid grid-cols-3 gap-2">
                      {userCovers.map((cover) => (
                        <div 
                          key={cover.id} 
                          onClick={() => updateCover(cover.url, 'upload')}
                          className="aspect-video rounded-lg overflow-hidden border border-transparent hover:border-blue-500/50 transition-all group/user relative cursor-pointer"
                        >
                          <img src={cover.url} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/user:opacity-100 transition-opacity flex items-start justify-end p-1">
                            <button 
                              onClick={(e) => deleteUserCover(e, cover)}
                              className="p-1 bg-black/60 rounded-md text-red-400 hover:text-red-500 hover:bg-black/80 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'upload' && (
              <div className="py-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex flex-col items-center justify-center gap-3 py-8 bg-[#111] border border-dashed border-white/10 rounded-2xl text-gray-500 hover:text-white hover:border-white/20 transition-all group"
                >
                  <div className="p-3 bg-white/5 rounded-full group-hover:bg-white/10 transition-all">
                    {isUploading ? <Loader2 size={20} className="animate-spin text-blue-400" /> : <Upload size={20} />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Select Image File</span>
                </button>
              </div>
            )}

            {activeTab === 'link' && (
              <form onSubmit={handleLinkSubmit} className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Paste an image URL</label>
                  <div className="relative">
                    <input 
                      autoFocus
                      type="text" 
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-[11px] text-white placeholder:text-gray-700 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                    <LinkIcon size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-700" />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="w-full py-4 bg-blue-500 text-white rounded-xl text-[12px] font-black uppercase tracking-widest hover:bg-blue-600 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-blue-500/20"
                >
                  Submit Link
                </button>
              </form>
            )}
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
