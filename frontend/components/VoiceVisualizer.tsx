'use client';

import { useEffect, useRef, useState } from 'react';

export default function VoiceVisualizer({ 
  isRecording, 
  stream: externalStream 
}: { 
  isRecording: boolean;
  stream?: MediaStream | null;
}) {
  const [bars, setBars] = useState<number[]>(new Array(25).fill(2));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    let isCancelled = false;
    if (isRecording) {
      if (externalStream) {
        setupAudio(externalStream);
      } else {
        startAudio(isCancelled);
      }
    } else {
      stopAudio();
    }
    return () => {
      isCancelled = true;
      stopAudio();
    };
  }, [isRecording, externalStream]);

  const startAudio = async (isCancelled: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (isCancelled) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      setupAudio(stream, true);
    } catch (err) {
      console.error("Error accessing microphone for visualizer:", err);
    }
  };

  const setupAudio = (stream: MediaStream, isInternal = false) => {
    if (isInternal) streamRef.current = stream;
    
    // Only create a new AudioContext if none exists or existing is closed
    // Use default sample rate for visualization (doesn't affect recording)
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      // Don't connect to destination — visualization only, no feedback loop
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      
      animate();
    } catch (err) {
      console.error("VoiceVisualizer audio setup error:", err);
    }
  };

  const stopAudio = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    dataArrayRef.current = null;
    setBars(new Array(25).fill(2));
  };

  const animate = () => {
    if (!analyserRef.current || !dataArrayRef.current || !audioContextRef.current) return;
    if (audioContextRef.current.state === 'closed') return;
    
    analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
    
    // Convert frequency data to heights (0-100)
    // We map the first 25 bins to our 25 bars
    const currentData = dataArrayRef.current;
    const newBars = Array.from(currentData.slice(0, 25)).map(val => 
      Math.max(2, (val / 255) * 100)
    );
    
    setBars(newBars);
    animationRef.current = requestAnimationFrame(animate);
  };

  return (
    <div className="flex items-end justify-center gap-[2px] h-8 w-full px-4 mb-2 animate-fade-in">
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-curo-accent to-curo-purple transition-all duration-75"
          style={{ 
            height: `${height}%`,
            opacity: 0.3 + (height / 100) * 0.7 
          }}
        />
      ))}
    </div>
  );
}
