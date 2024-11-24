# Meeting Visualizer

A real-time meeting transcription and visualization tool that generates diagrams and extracts action items from conversations.

## Setup

### Backend Setup

1. Create and activate virtual environment:
   ```bash
   # Create virtual environment
   python -m venv venv

   # Activate on Windows
   .\venv\Scripts\activate

   # Activate on macOS/Linux 
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   - Create a `.env` file in the root directory
   - Add the following variables:
     ```
     OPENAI_API_KEY=your_openai_api_key
     FRONTEND_URL=http://localhost:3000
     BACKEND_URL=http://localhost:8000
     ```

4. Start the backend server:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```