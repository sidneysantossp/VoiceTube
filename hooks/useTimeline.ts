import { useState, useEffect, useCallback } from 'react';
import { GeneratedClip, TimelineClip } from '../types';
import { arrayMove } from '@dnd-kit/sortable';
import { mixAudioTracks } from '../utils/audioUtils';

const COLORS = [
  'bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 
  'bg-amber-500', 'bg-cyan-500', 'bg-purple-500', 'bg-pink-500'
];

export function useTimeline() {
  const [tracks, setTracks] = useState<string[]>(['track-1', 'track-2']);
  
  const [timeline, setTimeline] = useState<TimelineClip[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_voice_timeline_v3');
      if (saved) {
        return JSON.parse(saved, (key, value) => {
          if (key === 'createdAt') return new Date(value);
          return value;
        });
      }
    } catch (e) {
      console.error("Failed to load timeline", e);
    }
    return [];
  });

  // Persist to LocalStorage
  useEffect(() => {
    localStorage.setItem('gemini_voice_timeline_v3', JSON.stringify(timeline));
  }, [timeline]);

  // Add a new track
  const addTrack = useCallback(() => {
      setTracks(prev => [...prev, `track-${Date.now()}`]);
  }, []);

  // Remove a track
  const removeTrack = useCallback((trackId: string) => {
      if (tracks.length <= 1) return; // Keep at least one track
      setTracks(prev => prev.filter(t => t !== trackId));
      // Remove clips in that track
      setTimeline(prev => prev.filter(clip => clip.trackId !== trackId));
  }, [tracks.length]);

  // Reorder tracks
  const moveTrack = useCallback((activeId: string, overId: string) => {
      setTracks((items) => {
          const oldIndex = items.indexOf(activeId);
          const newIndex = items.indexOf(overId);
          return arrayMove(items, oldIndex, newIndex);
      });
  }, []);

  const addClip = useCallback((clip: GeneratedClip, targetTrackId: string = 'track-1') => {
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const newClip: TimelineClip = {
      ...clip,
      instanceId: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: 0, // Calculated dynamically during mixing/render
      color: randomColor,
      duration: clip.duration || 5, // Default to 5s if duration unknown
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

  const moveClip = useCallback((activeId: string, overId: string, overTrackId?: string) => {
    setTimeline((prevTimeline) => {
        const activeIndex = prevTimeline.findIndex((t) => t.instanceId === activeId);
        const overIndex = prevTimeline.findIndex((t) => t.instanceId === overId);
        
        // Scenario 1: Reordering within the same track or moving to a specific position in another track (over a clip)
        if (activeIndex !== -1 && overIndex !== -1) {
            const activeClip = prevTimeline[activeIndex];
            const overClip = prevTimeline[overIndex];

            // If moving to a different track via sorting
            if (activeClip.trackId !== overClip.trackId) {
                const updatedClip = { ...activeClip, trackId: overClip.trackId };
                const newTimeline = [...prevTimeline];
                newTimeline[activeIndex] = updatedClip;
                return arrayMove(newTimeline, activeIndex, overIndex);
            }
            
            // Reorder same track
            return arrayMove(prevTimeline, activeIndex, overIndex);
        }

        // Scenario 2: Dropping onto an empty track container (overId is the track ID)
        if (activeIndex !== -1 && overTrackId) {
             const updatedClip = { ...prevTimeline[activeIndex], trackId: overTrackId };
             const newTimeline = [...prevTimeline];
             newTimeline[activeIndex] = updatedClip;
             // Move to the end of the timeline array so it renders at the end of the track visually
             // (assuming tracks render items in array order)
             return arrayMove(newTimeline, activeIndex, newTimeline.length - 1);
        }

        return prevTimeline;
    });
  }, []);

  const clearTimeline = useCallback(() => {
    setTimeline([]);
  }, []);

  // Helper to get duration of a specific track
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

  // Expose mixing capability directly from hook state
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
    moveClip,
    moveTrack,
    clearTimeline,
    addTrack,
    removeTrack,
    getTotalDuration,
    previewMix
  };
}