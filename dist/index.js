"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./services/database");
const uniformRoutes_1 = __importDefault(require("./routes/uniformRoutes"));
const staffRoutes_1 = __importDefault(require("./routes/staffRoutes"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config();
const startServer = async () => {
    try {
        // Initialize database first
        await (0, database_1.initializeDatabase)();
        const app = (0, express_1.default)();
        const port = process.env.PORT || 3000;
        // Middleware
        app.use((0, cors_1.default)());
        app.use(express_1.default.json());
        // Serve static files from the uniform-inventory directory
        const staticPath = path_1.default.join(process.cwd(), 'uniform-inventory');
        app.use(express_1.default.static(staticPath));
        console.log('Serving static files from:', staticPath);
        // API Routes
        app.use('/api/uniforms', uniformRoutes_1.default);
        app.use('/api/staff', staffRoutes_1.default);
        // Serve index.html for all other routes
        app.get('*', (req, res) => {
            res.sendFile(path_1.default.join(staticPath, 'index.html'));
        });
        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error('Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
        // Start server
        const server = app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use. Please try a different port or stop the other process.`);
            }
            else {
                console.error('Server error:', error);
            }
            process.exit(1);
        });
    }
    catch (error) {
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
