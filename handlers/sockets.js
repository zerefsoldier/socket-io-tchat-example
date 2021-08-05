const socketsDetails = {};
const previousMessages = [];

const MAX_GLOBAL_MESSAGES_TO_DISPLAY_FOR_NEW_USERS = 5;

const socketHandler = function(wsServer) {
    wsServer.on("connection", (socket) => {
        console.log("Socket connected: " + socket.id);
        // By default every socket is connected to room /

        socket.on("update_user_informations", (request) => {
            const datas = JSON.parse(request);
            const userWithEmail = Object.values(socketsDetails).find((user) => user.email.trim() === datas.email.trim());

            if (!userWithEmail) {
                socketsDetails[socket.id] = {
                    ...datas,
                    socketId: socket.id,
                };

                // send private tchats
                // get ws server adapter from / and read all rooms, then get all clients by foreach set of clients, into one dimensio array, client will handle repartition 
                const usersRooms = [];
                const allSids = wsServer.of("/").adapter.sids;
                for (const sid of allSids) {
                    if (sid[1].length > 1) {
                        for (const room of Array.from(sid[1]).slice(0, 1)) {
                            usersRooms.push([socketsDetails[sid[0]].email, room]);
                        }
                    }
                }
                socket.emit("connected", {
                    previousMessages,
                    usersRooms,
                });
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

        socket.on("join_other", (datas) => {
            const socketsService = require("../logic/socketsService");

            if (datas.type === "init") {
                socketsService.connectFirstClientsOfRoom(wsServer, socket, datas.socketId, socketsDetails);
            } else {
                socketsService.connectClientAfterRoomIsCreated(wsServer, datas.room, socket, socketsDetails);
            }
        });

        socket.on("private_message", (request) => {
            const datas = JSON.parse(request);
            socket.to(datas.room).emit("private_message_received", {
                room: datas.room,
                sender: `${socketsDetails[socket.id].firstname}.${socketsDetails[socket.id].lastname.toUpperCase()}`,
                message: datas.message,
            });
        });

        socket.on("message_to_all", (message) => {
            socket.broadcast.emit("message", {
                sender: `${socketsDetails[socket.id].firstname}.${socketsDetails[socket.id].lastname.toUpperCase()}`,
                message
            });

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
