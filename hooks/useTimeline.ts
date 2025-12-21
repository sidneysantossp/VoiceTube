
import { useState, useEffect, useCallback } from 'react';
import { GeneratedClip, TimelineClip } from '../types';
import { mixAudioTracks } from '../utils/audioUtils';

const COLORS = [
  'bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 
  'bg-amber-500', 'bg-cyan-500', 'bg-purple-500', 'bg-pink-500'
];

export function useTimeline() {
  const [tracks, setTracks] = useState<string[]>(['track-1', 'track-2']);
  
  const [timeline, setTimeline] = useState<TimelineClip[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_voice_timeline_v5');
      if (saved) {
        return JSON.parse(saved, (key, value) => {
          if (key === 'createdAt') return new Date(value);
          return value;
        }) || [];
      }
    } catch (e) {
      console.error("Failed to load timeline from storage. Resetting.", e);
      localStorage.removeItem('gemini_voice_timeline_v5');
    }
    return [];
  });

  // Persist to LocalStorage
  useEffect(() => {
    localStorage.setItem('gemini_voice_timeline_v5', JSON.stringify(timeline));
  }, [timeline]);

  const addTrack = useCallback(() => {
      setTracks(prev => [...prev, `track-${Date.now()}`]);
  }, []);

  const removeTrack = useCallback((trackId: string) => {
      if (tracks.length <= 1) return;
      setTracks(prev => prev.filter(t => t !== trackId));
      setTimeline(prev => prev.filter(clip => clip.trackId !== trackId));
  }, [tracks.length]);

  const addClip = useCallback((clip: GeneratedClip, targetTrackId: string = 'track-1') => {
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const newClip: TimelineClip = {
      ...clip,
      instanceId: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: 0,
      color: randomColor,
      duration: clip.duration || 5,
      trackId: targetTrackId,
      startOffset: 0
    };
    
    setTimeline(prev => [...prev, newClip]);
  }, []);

  const removeClip = useCallback((instanceId: string) => {
    setTimeline(prev => prev.filter(c => c.instanceId !== instanceId));
  }, []);

  const updateClip = useCallback((instanceId: string, updates: Partial<TimelineClip>) => {
    setTimeline(prev => prev.map(clip => 
      clip.instanceId === instanceId ? { ...clip, ...updates } : clip
    ));
  }, []);

  // Native Move Logic: Move clip to a specific track (append to end)
  const moveClipToTrack = useCallback((instanceId: string, targetTrackId: string) => {
      setTimeline(prev => prev.map(c => 
          c.instanceId === instanceId ? { ...c, trackId: targetTrackId } : c
      ));
  }, []);

  // Native Swap Logic: Swap two clips (reordering)
  const swapClips = useCallback((sourceId: string, targetId: string) => {
      setTimeline(prev => {
          const sourceIndex = prev.findIndex(c => c.instanceId === sourceId);
          const targetIndex = prev.findIndex(c => c.instanceId === targetId);
          
          if (sourceIndex === -1 || targetIndex === -1) return prev;
          if (sourceIndex === targetIndex) return prev;

          const newTimeline = [...prev];
          
          // Swap the objects in the array
          const temp = newTimeline[sourceIndex];
          newTimeline[sourceIndex] = newTimeline[targetIndex];
          newTimeline[targetIndex] = temp;

          // IMPORTANT: Swap their Track IDs to maintain visual consistency if tracks differ
          const sourceTrack = temp.trackId;
          const targetTrack = newTimeline[sourceIndex].trackId; // The one we swapped with

          // We want the source clip (now at targetIndex) to adopt the target's track
          newTimeline[targetIndex] = { ...newTimeline[targetIndex], trackId: targetTrack };
          // We want the target clip (now at sourceIndex) to adopt the source's track
          newTimeline[sourceIndex] = { ...newTimeline[sourceIndex], trackId: sourceTrack };

          return newTimeline;
      });
  }, []);

  const clearTimeline = useCallback(() => {
    setTimeline([]);
  }, []);

  const getTrackDuration = (trackId: string) => {
      const trackClips = timeline.filter(c => c.trackId === trackId);
      return trackClips.reduce((acc, clip) => acc + (clip.duration || 0) + (clip.startOffset || 0), 0);
  };

  const getTotalDuration = () => {
      let max = 0;
      tracks.forEach(t => {
          const d = getTrackDuration(t);
          if (d > max) max = d;
      });
      return max;
  };

  const previewMix = useCallback(async () => {
      if (timeline.length === 0) return null;
      return await mixAudioTracks(timeline);
  }, [timeline]);

  return {
    timeline,
    tracks,
    addClip,
    removeClip,
    updateClip,
    moveClipToTrack,
    swapClips,
    moveTrack: () => {}, // Deprecated for simplicity in native mode
    clearTimeline,
    addTrack,
    removeTrack,
    getTotalDuration,
    previewMix
  };
}
