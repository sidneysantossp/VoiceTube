import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  stream?: MediaStream;
  barColor?: string;
  width?: number;
  height?: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  isActive, 
  stream, 
  barColor = '#3b82f6',
  width = 120,
  height = 40
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const connectionTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // Clean up function to close AudioContext when component unmounts
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive || !stream || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize Audio Context for visualization only
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const audioCtx = audioContextRef.current;
    
    // Create analyser
    if (!analyserRef.current) {
      analyserRef.current = audioCtx.createAnalyser();
      analyserRef.current.fftSize = 64;
      analyserRef.current.smoothingTimeConstant = 0.8;
    }
    const analyser = analyserRef.current;

    const connectStream = () => {
        try {
            // Check if stream has audio tracks. 
            // In some browsers, captureStream() returns an empty stream initially until playback starts.
            if (stream.getAudioTracks().length === 0) {
                 // Retry connecting shortly
                 connectionTimeoutRef.current = setTimeout(connectStream, 100);
                 return;
            }

            if (sourceRef.current) {
              sourceRef.current.disconnect();
            }
            sourceRef.current = audioCtx.createMediaStreamSource(stream);
            sourceRef.current.connect(analyser);
        } catch (e) {
            console.warn("Error connecting stream to visualizer, retrying...", e);
             // Retry just in case
            connectionTimeoutRef.current = setTimeout(connectStream, 250);
        }
    };

    connectStream();

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isActive) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        
        ctx.fillStyle = barColor;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, 4);
        } else {
            ctx.rect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        }
        ctx.fill();

        x += barWidth;
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
    };
  }, [isActive, stream, barColor]);

  // Clean initial state if inactive
  useEffect(() => {
    if (!isActive && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="w-full h-full"
    />
  );
};

export default AudioVisualizer;