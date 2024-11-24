import React, { useEffect, useState, useRef, useCallback } from 'react';
import { WebSocketClient } from '../services/WebSocketClient';

interface Props {
  transcript: string;
  onUpdate?: (data: any) => void;
}

export const TranscriptView: React.FC<Props> = ({ transcript, onUpdate }) => {
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const isShuttingDown = useRef(false);
  const [diagram, setDiagram] = useState<string>('');
  const [actionItems, setActionItems] = useState<string[]>([]);

  const connectWebSocket = useCallback(() => {
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const client = new WebSocketClient('ws://localhost:8000/ws/audio');
    
    client.onConnect(() => {
      setIsConnected(true);
      console.log('Connected to WebSocket');
      reconnectAttempts.current = 0;
    });

    client.onMessage((data) => {
      console.log('Received message:', data);
      handleUpdate(data);
    });

    client.onDisconnect(() => {
      setIsConnected(false);
      console.log('Disconnected from WebSocket');
      
      if (!isShuttingDown.current) {
        reconnectAttempts.current += 1;
        reconnectTimeout.current = setTimeout(() => {
          console.log(`Attempting to reconnect... (${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
          connectWebSocket();
        }, 2000);
      }
    });

    setWsClient(client);
  }, [onUpdate]);

  const cleanupAudio = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContext.current) {
      audioContext.current.close();
      audioContext.current = null;
    }
  };

  const startRecording = async () => {
    try {
      if (!isConnected) {
        alert('WebSocket is not connected. Please wait for reconnection.');
        return;
      }

      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      audioContext.current = new AudioContext();
      sourceRef.current = audioContext.current.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContext.current.createScriptProcessor(2048, 1, 1);

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContext.current.destination);

      processorRef.current.onaudioprocess = (e) => {
        if (wsClient && isRecording && isConnected) {
          const inputData = e.inputBuffer.getChannelData(0);
          wsClient.sendAudio(inputData);
        }
      };

      setIsRecording(true);
      console.log('Recording started');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Error accessing microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    cleanupAudio();
    console.log('Recording stopped');
  };

  const handleUpdate = (data: any) => {
    if (data.type === 'update') {
      if (data.data.transcript) {
        onUpdate?.(data);
      }
      if (data.data.diagram) {
        setDiagram(data.data.diagram);
      }
      if (data.data.action_items) {
        setActionItems(Array.isArray(data.data.action_items) 
          ? data.data.action_items 
          : [data.data.action_items]);
      }
    }
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      isShuttingDown.current = true;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (wsClient) {
        wsClient.disconnect();
      }
      cleanupAudio();
    };
  }, [connectWebSocket]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-6 py-2 rounded-full font-medium transition-colors ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } ${!isConnected && 'opacity-50 cursor-not-allowed'}`}
              disabled={!isConnected}
            >
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isRecording ? 'animate-pulse bg-white' : ''}`} />
                <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
              </div>
            </button>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Transcript</h2>
            <div className="whitespace-pre-wrap max-h-[calc(100vh-250px)] overflow-y-auto">
              {transcript || 'No transcript available yet. Click "Start Recording" to begin.'}
            </div>
          </div>

          <div className="space-y-6">
            {diagram && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Generated Diagram</h2>
                <div className="mermaid">
                  {diagram}
                </div>
              </div>
            )}

            {actionItems.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Action Items</h2>
                <ul className="space-y-2">
                  {actionItems.map((item, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 