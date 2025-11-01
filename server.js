import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors({
  origin: [
    "https://inplaystream.app",
    "http://localhost:3000"  // ✅ allow dev mode
  ]
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://inplaystream.app",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true,
    transports: ["websocket"]
  },
  allowEIO3: true
});

app.get("/", (req, res) => {
  res.send("✅ InplayStream backend WebSocket running!");
});

// ✅ Room storage
const rooms = {};

io.on("connection", (socket) => {
  console.log("🟢 WS Connected:", socket.id);

  socket.on("join-room", ({ roomId, user }) => {
    console.log(`📌 ${user} joined room: ${roomId}`);

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        teacher: null,
        students: [],
        chat: [],
      };
    }

    if (user === "Teacher") {
      rooms[roomId].teacher = socket.id;
    } else {
      if (!rooms[roomId].students.includes(socket.id)) {
        rooms[roomId].students.push(socket.id);
      }
    }

    // ✅ Send chat history only to new client
    socket.emit("chatHistory", rooms[roomId].chat);
  });

  socket.on("chatMessage", ({ roomId, ...msg }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].chat.push(msg);
    io.to(roomId).emit("chatMessage", msg);
  });

  socket.on("offer", ({ roomId, signal }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].students.forEach(studentId =>
      io.to(studentId).emit("offer", { signal })
    );
  });

  socket.on("answer", ({ roomId, signal }) => {
    if (!rooms[roomId]) return;
    const teacherId = rooms[roomId].teacher;
    if (teacherId)
      io.to(teacherId).emit("answer", { signal });
  });

  socket.on("disconnect", () => {
    console.log("🔴 WS Disconnected:", socket.id);

    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];

      if (room.teacher === socket.id) {
        io.to(roomId).emit("roomClosed");
        delete rooms[roomId];
      } else {
        room.students = room.students.filter(s => s !== socket.id);
      }
    });
  });
});

// ✅ Required for Render
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => 
  console.log(`🚀 WebSocket server running on PORT ${PORT}`)
);
