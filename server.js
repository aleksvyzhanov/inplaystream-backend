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

let chatHistory = [];

app.get("/", (req, res) => {
  res.send("✅ InplayStream backend is LIVE");
});

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // send existing history to the new client
  socket.emit("chatHistory", chatHistory);

  socket.on("chatMessage", (data) => {
    chatHistory.push(data);
    io.emit("chatMessage", data);
  });

  // optional: signaling hooks (safe to keep)
  socket.on("offer", (payload) => socket.to(payload.target).emit("offer", payload));
  socket.on("answer", (payload) => socket.to(payload.target).emit("answer", payload));
  socket.on("ice-candidate", (incoming) => socket.to(incoming.target).emit("ice-candidate", incoming.candidate));

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));