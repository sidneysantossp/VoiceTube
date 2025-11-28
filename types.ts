
export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: 'Male' | 'Female';
  isCustom?: boolean; // Flag to identify cloned voices
  base64Audio?: string; // Base64 string of the recorded audio for cloning
}

export interface GeneratedClip {
  id: string;
  text: string;
  voiceName: string;
  audioUrl: string;
  createdAt: Date;
  duration?: number;
}

export interface TimelineClip extends GeneratedClip {
  instanceId: string; // Unique ID for the specific instance in the timeline
  startTime: number; // Calculated start time in seconds relative to the track start
  color: string; // Visual color for the block
  trackId: string; // The track this clip belongs to
  duration: number; // Duration is mandatory for timeline
  startOffset?: number; // Silence/Gap in seconds before this clip starts
}

export interface MergedClip {
  id: string;
  name: string; // e.g., "Edição 1"
  audioUrl: string;
  createdAt: Date;
  duration: number;
  clipCount: number;
}

export interface ScriptBlock {
  id: string;
  text: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role: 'user' | 'admin';
  is_banned?: boolean;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: string;
  description: string;
}

export const INITIAL_VOICES: VoiceOption[] = [
  {
    id: 'Puck',
    name: 'Puck',
    description: 'Energético e claro, bom para narração.',
    gender: 'Male'
  },
  {
    id: 'Charon',
    name: 'Charon',
    description: 'Profundo e ressonante, adequado para tópicos sérios.',
    gender: 'Male'
  },
  {
    id: 'Kore',
    name: 'Kore',
    description: 'Calmo e suave, excelente para mindfulness.',
    gender: 'Female'
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    description: 'Forte e autoritário, ideal para notícias.',
    gender: 'Male'
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    description: 'Equilibrado e polido, ótimo para assistentes virtuais.',
    gender: 'Female'
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    description: 'Confiante e profissional, ideal para negócios.',
    gender: 'Female'
  }
];
