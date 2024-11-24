import React, { useState } from 'react';
import { TranscriptView } from './components/TranscriptView';
import { Layout } from './components/Layout';

const App: React.FC = () => {
  const [transcript, setTranscript] = useState<string>('');

  const handleTranscriptUpdate = (data: any) => {
    if (data.type === 'update' && data.data.transcript) {
      setTranscript(prev => prev + data.data.transcript);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <TranscriptView 
          transcript={transcript} 
          onUpdate={handleTranscriptUpdate} 
        />
      </div>
    </Layout>
  );
};

export default App; 