import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { YSocketIO } from "y-socket.io/dist/server";

const app = express();
app.use(express.static("public")); //This is a middleware that serves static files from the public directory. It allows you to serve HTML, CSS, JavaScript, and other static assets directly from the server without needing to set up additional routes for each file.
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const ySocketIO = new YSocketIO(io);
ySocketIO.initialize();

// app.get("/", (req, res)=>{
//     res.status(200).json({
//         message: "Server is running",
//         success: true
//     })
// })

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "Server is healthy",
    success: true,
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
