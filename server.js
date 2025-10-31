import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.get("/", (req, res) => {
  res.send("✅ InplayStream backend running with rooms!");
});

// ✅ Room storage (memory-based for now)
const rooms = {};

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("join-room", ({ roomId, user }) => {
    console.log(`📌 ${user} joining room:`, roomId);

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
      rooms[roomId].students.push(socket.id);
    }

    // ✅ Send chat history only for this room
    socket.emit("chatHistory", rooms[roomId].chat);
  });

  socket.on("chatMessage", ({ roomId, ...msg }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].chat.push(msg);
    io.to(roomId).emit("chatMessage", msg);
  });

  // ✅ WebRTC Offer: Teacher → Room
  socket.on("offer", ({ roomId, sender, signal }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].students.forEach(studentId => {
      io.to(studentId).emit("offer", { signal });
    });
  });

  // ✅ WebRTC Answer: Student → Teacher
  socket.on("answer", ({ roomId, sender, signal }) => {
    if (!rooms[roomId]) return;

    const teacherId = rooms[roomId].teacher;
    if (teacherId) {
      io.to(teacherId).emit("answer", { signal });
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      if (room.teacher === socket.id) {
        delete rooms[roomId];
        io.to(roomId).emit("roomClosed");
      } else {
        room.students = room.students.filter(s => s !== socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));