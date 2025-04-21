import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './services/database';
import uniformRoutes from './routes/uniformRoutes';
import staffRoutes from './routes/staffRoutes';
import path from 'path';

// Load environment variables
dotenv.config();

const startServer = async () => {
  try {
    // Initialize database first
    await initializeDatabase();

    const app = express();
    const port = process.env.PORT || 3000;

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Serve static files from the uniform-inventory directory
    const staticPath = path.join(process.cwd(), 'uniform-inventory');
    app.use(express.static(staticPath));
    console.log('Serving static files from:', staticPath);

    // API Routes
    app.use('/api/uniforms', uniformRoutes);
    app.use('/api/staff', staffRoutes);

    // Serve index.html for all other routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(staticPath, 'index.html'));
    });

    // Error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });

    // Start server
    const server = app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please try a different port or stop the other process.`);
      } else {
        console.error('Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer(); 