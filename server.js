// ✅ InplayStream — WebRTC signaling + room-based chat

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true
  }
});

// Room memory structure
// rooms = { [roomId] : { teacherConnected: boolean, users: Map(socketId -> { name, role }) } }
const rooms = {};

app.get("/", (req, res) => {
  res.send("✅ InplayStream backend is LIVE");
});

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // ✅ Join room (both teacher and students)
  socket.on("join-room", ({ roomId, user, role }) => {
    if (!roomId) return;

    if (!rooms[roomId]) {
      rooms[roomId] = { teacherConnected: false, users: new Map() };
    }

    const room = rooms[roomId];

    if (role === "Teacher") {
      room.teacherConnected = true;
    }

    socket.join(roomId);
    room.users.set(socket.id, { user, role });

    console.log(`👤 ${role} "${user}" joined room ${roomId}`);

    // Notify teacher that student joined
    socket.to(roomId).emit("user-joined", { user, role });

    // Notify new user of room state
    socket.emit("room-status", { teacherConnected: room.teacherConnected });
  });

  // ✅ WebRTC signaling
  socket.on("offer", ({ roomId, signal }) => {
    socket.to(roomId).emit("offer", { signal });
  });

  socket.on("answer", ({ roomId, signal }) => {
    socket.to(roomId).emit("answer", { signal });
  });

  // ✅ Chat inside room only
  socket.on("chatMessage", (msg) => {
    const { roomId } = msg;
    if (!roomId) return;
    socket.to(roomId).emit("chatMessage", msg);
  });

  // ✅ Disconnect + cleanup
  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.users.has(socket.id)) {
        const { role } = room.users.get(socket.id);
        room.users.delete(socket.id);

        if (role === "Teacher") {
          room.teacherConnected = false;
          socket.to(roomId).emit("room-status", { teacherConnected: false });
        }

        if (room.users.size === 0 && !room.teacherConnected) {
          delete rooms[roomId];
        }
        break;
      }
    }
    console.log("🔴 User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Backend running on PORT ${PORT}`));
