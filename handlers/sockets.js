const randomstring = require('randomstring');
const socketsDetails = {};
const previousMessages = [];

const MAX_GLOBAL_MESSAGES_TO_DISPLAY_FOR_NEW_USERS = 5;

function integrateSocketToRoom(serverAdapter, socketId, room) {
    serverAdapter.sids.get(socketId).add(room);

    if (!serverAdapter.rooms.get(room)) serverAdapter.rooms.set(room, new Set([socketId]));
    else serverAdapter.rooms.get(room).add(socketId);
}

const socketHandler = function(wsServer) {
    wsServer.on("connection", (socket) => {
        console.log("Socket connected: " + socket.id);

        socket.on("update_user_informations", (request) => {
            const datas = JSON.parse(request);
            const userWithEmail = Object.values(socketsDetails).find((user) => user.email.trim() === datas.email.trim());

            if (!userWithEmail) {
                socketsDetails[socket.id] = {
                    ...datas,
                    socketId: socket.id,
                };

                socket.emit("connected", JSON.stringify(previousMessages));
                socket.broadcast.emit("new_user", JSON.stringify(socketsDetails[socket.id]));
            } else {
                socket.emit("error", "Le mail à déjà été pris");
            }
        });
    
        socket.on("get_clients", () => {
            const sockets = wsServer.of("/").adapter.sids;
            const socketsDetailsList = [];
            sockets.forEach((socketAdapter) => {
                const socketId = socketAdapter.values().next().value;
                if (socketId !== socket.id) {
                    socketsDetailsList.push(socketsDetails[socketId]);
                }
            });

            socket.emit("clients_list", JSON.stringify(socketsDetailsList));
            socket.broadcast.emit("new_client", JSON.stringify(socketsDetails[socket.id]));
        });

        socket.on("join_other", (otherSocketId) => {
            const room = randomstring.generate();
            const serverAdapter = wsServer.of("/").adapter;

            integrateSocketToRoom(serverAdapter, socket.id, room); // We can use socket.join(room) too
            integrateSocketToRoom(serverAdapter, otherSocketId, room);

            socket.to(room).emit("private_chatbox_opened", JSON.stringify({
                room,
                email: socketsDetails[socket.id].email,
            }));
            socket.emit("private_chatbox", room);
        });

        socket.on("private_message", (request) => {
            const datas = JSON.parse(request);
            socket.to(datas.room).emit("private_message_received", JSON.stringify({
                room: datas.room,
                sender: `${socketsDetails[socket.id].firstname}.${socketsDetails[socket.id].lastname.toUpperCase()}`,
                message: datas.message,
            }));
        });

        socket.on("message_to_all", (message) => {
            socket.broadcast.emit("message", JSON.stringify({
                sender: `${socketsDetails[socket.id].firstname}.${socketsDetails[socket.id].lastname.toUpperCase()}`,
                message
            }));

            previousMessages.push(`${socketsDetails[socket.id].firstname}.${socketsDetails[socket.id].lastname.toUpperCase()} à écrit : ${message}`);
            if (previousMessages.length > MAX_GLOBAL_MESSAGES_TO_DISPLAY_FOR_NEW_USERS) {
                previousMessages.splice(0, 1);
            }
        });

        // If server felt down, we reconnect users to others to rebuild private tchats
        socket.on("reconnect_rooms", (request) => {
            const rooms = JSON.parse(request);
            rooms.forEach((room) => { socket.join(room); });
        });
    });
}

module.exports = socketHandler;
