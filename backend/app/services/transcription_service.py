import whisper
import numpy as np
from typing import Dict, List, Optional, Callable
from datetime import datetime
import openai
from pydantic import BaseModel
import asyncio
from fastapi import WebSocket
import json
from queue import Queue
import threading
import time

class ActionItem(BaseModel):
    task: str
    assignee: Optional[str]
    due_date: Optional[datetime]
    context: Optional[str]
    status: str = "pending"
    created_at: datetime = datetime.now()

class DiagramMetadata(BaseModel):
    diagram_type: str
    content: str
    relationships: List[Dict[str, str]]
    title: Optional[str]
    created_at: datetime = datetime.now()
    last_updated: datetime = datetime.now()

class TranscriptionService:
    def __init__(self, openai_api_key: str):
        self.model = whisper.load_model("base")
        self.openai_client = openai.OpenAI(api_key=openai_api_key)
        self.current_transcript = ""
        self.action_items: List[ActionItem] = []
        self.diagrams: List[DiagramMetadata] = []
        self.websocket_clients: List[WebSocket] = []
        self.audio_buffer = Queue()
        self.processing_thread = None
        self.is_processing = False
        
        # Initialize background processing
        self.start_background_processing()

    def start_background_processing(self):
        """Start background thread for audio processing"""
        self.is_processing = True
        self.processing_thread = threading.Thread(target=self._process_audio_buffer)
        self.processing_thread.start()

    def stop_background_processing(self):
        """Stop background processing"""
        self.is_processing = False
        if self.processing_thread:
            self.processing_thread.join()

    def _process_audio_buffer(self):
        """Process audio chunks from buffer"""
        while self.is_processing:
            if not self.audio_buffer.empty():
                chunks = []
                # Collect all available chunks
                while not self.audio_buffer.empty():
                    chunks.append(self.audio_buffer.get())
                
                # Combine chunks and process
                combined_audio = np.concatenate(chunks)
                asyncio.run(self.process_audio_chunk(combined_audio))
            
            time.sleep(0.1)  # Prevent CPU overload

    async def register_client(self, websocket: WebSocket):
        """Register a new WebSocket client"""
        await websocket.accept()
        self.websocket_clients.append(websocket)
        # Send current state to new client
        await websocket.send_json(self.get_current_state())

    async def remove_client(self, websocket: WebSocket):
        """Remove a WebSocket client"""
        self.websocket_clients.remove(websocket)

    async def broadcast_update(self, update_type: str, data: dict):
        """Broadcast updates to all connected clients"""
        message = json.dumps({"type": update_type, "data": data})
        for client in self.websocket_clients:
            try:
                await client.send_text(message)
            except Exception:
                await self.remove_client(client)

    async def process_audio_chunk(self, audio_chunk: np.ndarray) -> str:
        """Process incoming audio chunks and return transcribed text"""
        result = self.model.transcribe(audio_chunk)
        transcribed_text = result["text"]
        self.current_transcript += transcribed_text
        
        # Broadcast transcript update
        await self.broadcast_update("transcript", {"text": transcribed_text})
        
        # Process the updated transcript for new insights
        await self._analyze_content()
        return transcribed_text

    async def _analyze_content(self):
        """Analyze transcript content for diagrams and action items"""
        # Process in parallel
        diagram_task = asyncio.create_task(self._generate_diagram_spec())
        action_items_task = asyncio.create_task(self._extract_action_items())
        
        # Wait for both tasks to complete
        diagram, action_items = await asyncio.gather(diagram_task, action_items_task)
        
        if diagram:
            self.diagrams.append(diagram)
            await self.broadcast_update("diagram", diagram.dict())
        
        if action_items:
            self.action_items.extend(action_items)
            await self.broadcast_update("action_items", 
                                     [item.dict() for item in action_items])

    async def _generate_diagram_spec(self) -> Optional[DiagramMetadata]:
        """Generate diagram specifications using OpenAI."""
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": """
                     Analyze the conversation and generate a Mermaid diagram specification.
                     Identify key concepts, processes, and relationships.
                     Output should be in the format:
                     {
                         "diagram_type": "flowchart|mindmap|sequence",
                         "content": "mermaid_specification",
                         "relationships": [{"from": "entity1", "to": "entity2", "type": "relationship_type"}]
                     }
                     """},
                    {"role": "user", "content": self.current_transcript}
                ]
            )
            
            diagram_spec = response.choices[0].message.content
            # Parse and validate diagram specification
            # Add to diagrams list if valid
            return DiagramMetadata.model_validate_json(diagram_spec)
        except Exception as e:
            print(f"Error generating diagram: {str(e)}")
            return None

    async def _extract_action_items(self) -> List[ActionItem]:
        """Extract action items from the transcript."""
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": """
                     Extract action items from the conversation.
                     For each action item, identify:
                     - Task description
                     - Assignee (if mentioned)
                     - Due date (if mentioned)
                     - Related context
                     """},
                    {"role": "user", "content": self.current_transcript}
                ]
            )
            
            action_items_raw = response.choices[0].message.content
            # Parse and validate action items
            # Convert to ActionItem objects
            return [ActionItem.model_validate_json(item) for item in action_items_raw.split('\n') if item.strip()]
            
        except Exception as e:
            print(f"Error extracting action items: {str(e)}")
            return []

    def get_current_state(self) -> Dict:
        """Return the current state of transcription, diagrams, and action items."""
        return {
            "transcript": self.current_transcript,
            "diagrams": [diagram.dict() for diagram in self.diagrams],
            "action_items": [item.dict() for item in self.action_items]
        }

    def export_diagram(self, diagram_id: int, format: str = "svg") -> bytes:
        """Export a diagram in the specified format."""
        if diagram_id >= len(self.diagrams):
            raise ValueError("Invalid diagram ID")
        
        diagram = self.diagrams[diagram_id]
        # Convert Mermaid specification to the requested format
        # Implementation depends on the chosen rendering library
        # Return the diagram in the specified format
        pass 