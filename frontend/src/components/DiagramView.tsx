import React from 'react';
import mermaid from 'mermaid';

interface Props {
  diagrams: any[];
}

export const DiagramView: React.FC<Props> = ({ diagrams }) => {
  React.useEffect(() => {
    mermaid.initialize({ startOnLoad: true });
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Generated Diagrams</h2>
      {diagrams.map((diagram, index) => (
        <div key={index} className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">{diagram.title || `Diagram ${index + 1}`}</h3>
          <div className="mermaid">{diagram.content}</div>
        </div>
      ))}
    </div>
  );
}; 