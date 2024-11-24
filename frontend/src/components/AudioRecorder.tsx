import React, { useState, useRef } from 'react';
import { WebSocketClient } from '../services/WebSocketClient';

interface Props {
  wsClient: WebSocketClient | null;
}

export const AudioRecorder: React.FC<Props> = ({ wsClient }) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0 && wsClient) {
          // Convert to float32 array before sending
          const reader = new FileReader();
          reader.onloadend = () => {
            const buffer = reader.result as ArrayBuffer;
            const float32Array = new Float32Array(buffer);
            wsClient.sendAudio(float32Array);
          };
          reader.readAsArrayBuffer(event.data);
        }
      };

      mediaRecorder.current.start(100); // Collect 100ms chunks
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  return (
    <div className="flex items-center justify-center space-x-4">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`px-4 py-2 rounded-full ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white`}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      {isRecording && (
        <div className="animate-pulse w-3 h-3 rounded-full bg-red-500" />
      )}
    </div>
  );
}; 