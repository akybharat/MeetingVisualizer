from fastapi import FastAPI, WebSocket, HTTPException, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List
import json
import numpy as np
import os
from dotenv import load_dotenv
import asyncio
import logging
import whisper
import openai

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI()
model = whisper.load_model("base")
openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.shutdown_event = asyncio.Event()
        self.current_transcript = ""

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("New WebSocket connection established")

    async def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            try:
                await websocket.close()
                logger.info("WebSocket connection closed")
            except:
                pass

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {str(e)}")
                disconnected.append(connection)
        
        for conn in disconnected:
            await self.disconnect(conn)

    async def process_audio(self, audio_data: np.ndarray):
        try:
            # Process audio with Whisper
            result = model.transcribe(audio_data)
            transcribed_text = result["text"]
            self.current_transcript += transcribed_text

            # Generate diagram using OpenAI
            diagram = await self.generate_diagram(self.current_transcript)

            # Extract action items
            action_items = await self.extract_action_items(self.current_transcript)

            return {
                "transcript": transcribed_text,
                "diagram": diagram,
                "action_items": action_items
            }
        except Exception as e:
            logger.error(f"Error processing audio: {str(e)}")
            return {"error": str(e)}

    async def generate_diagram(self, text: str):
        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Generate a Mermaid diagram based on the conversation. Focus on key concepts and relationships."},
                    {"role": "user", "content": text}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generating diagram: {str(e)}")
            return None

    async def extract_action_items(self, text: str):
        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Extract action items from the conversation. Format as a list of tasks with assignees and due dates if mentioned."},
                    {"role": "user", "content": text}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error extracting action items: {str(e)}")
            return []

manager = ConnectionManager()

@app.websocket("/ws/audio")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while not manager.shutdown_event.is_set():
            try:
                # Receive audio data with a timeout
                data = await asyncio.wait_for(websocket.receive_bytes(), timeout=1.0)
                logger.info(f"Received audio chunk of size: {len(data)} bytes")
                
                # Convert bytes to numpy array
                audio_array = np.frombuffer(data, dtype=np.float32)
                logger.info(f"Converted to numpy array of shape: {audio_array.shape}")
                
                # Process audio and generate results
                results = await manager.process_audio(audio_array)
                
                # Broadcast results to all connected clients
                await manager.broadcast({
                    "type": "update",
                    "data": results
                })
                
            except asyncio.TimeoutError:
                continue
            except WebSocketDisconnect:
                logger.info("WebSocket disconnected")
                await manager.disconnect(websocket)
                break
            except Exception as e:
                logger.error(f"Error processing audio: {str(e)}")
                await manager.broadcast({
                    "type": "error",
                    "data": {"message": str(e)}
                })
                
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        await manager.disconnect(websocket)

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"} 