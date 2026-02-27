const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("location_update", (data) => {
        // Broadcoast to all (including admin)
        console.log("Location received:", data.tripId, data.coords);
        io.emit("location_stream", data);
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

const PORT = 3030;
server.listen(PORT, () => {
    console.log(`Socket Gateway running on port ${PORT}`);
});
