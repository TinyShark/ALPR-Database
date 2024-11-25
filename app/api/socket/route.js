import { Server } from 'socket.io';
import { NextResponse } from 'next/server';

// Configure the runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let io;

export async function GET(request) {
  try {
    if (io) {
      return NextResponse.json({ 
        status: 'connected',
        message: 'Socket.IO is already running'
      });
    }

    // Access the server from the global scope
    const server = global.__server;
    
    if (!server) {
      console.error('Server not available in global scope');
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { 
        status: 500 
      });
    }

    io = new Server(server, {
      path: '/api/socketio',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    // Store the io instance globally
    global.io = io;

    io.on('connection', socket => {
      console.log('Client connected:', socket.id);
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    return NextResponse.json({ 
      status: 'success',
      message: 'Socket.IO initialized'
    });

  } catch (error) {
    console.error('Socket initialization error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { 
      status: 500 
    });
  }
} 