# Math AI Tutor

### Instruction placeholder....

## Quick Start

### Prerequisites

Install Node.js 18+, Python 3.9+, and Git. 

### Installation

Clone the repository and navigate to the project directory. Set up the backend by creating a virtual environment, activating it, and installing dependencies from requirements.txt. Set up the frontend by installing npm packages.

```bash
git clone URL
cd AI_tutor

# Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install
```

### Configuration

Copy `backend/.env.example` to `backend/.env` and add your API key.

```bash
cd backend
cp .env.example .env
# Edit .env and add: API_KEY=your-key-here
```

### Running the Application

Start the backend server in one terminal and the frontend development server in another. The application will be available at localhost:5173.

```bash
# Terminal 1 - Backend
cd backend
source .venv/bin/activate #(if not in virtual environment)
python main.py

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

## Tech Stack

The frontend uses React 18 with TypeScript and Vite. The backend runs on Python with FastAPI and integrates with OpenAI's GPT API for AI tutoring responses.

## Project Structure

The backend directory contains the FastAPI server and Python dependencies. The frontend directory contains the React application with TypeScript source files. Configuration files include environment variables in .env and package dependencies in package.json and requirements.txt.

## License

MIT License - see LICENSE file for details.

---
