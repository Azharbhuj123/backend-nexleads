const socketIo = require("socket.io");


const initializeSocket = (server) => {
    const io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true,
      },
      pingInterval: 25000,
      pingTimeout: 60000,
    });
    io.on("connection", (socket) => {
      console.log("New connection " + socket.id);
  
      socket.on("join", async (userId) => {
          socket.join(userId);
          console.log(`Client ${socket.id} joined room: ${userId}`);
      });

      socket.on("disconnect", () => {
        console.log("User disconnected");
      });
    });
    return io;
  };

module.exports = initializeSocket;
