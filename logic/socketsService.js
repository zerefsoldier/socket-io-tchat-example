function integrateSocketToRoom(serverAdapter, socketId, room) {
    serverAdapter.sids.get(socketId).add(room);

    if (!serverAdapter.rooms.get(room)) serverAdapter.rooms.set(room, new Set([socketId]));
    else serverAdapter.rooms.get(room).add(socketId);
}

module.exports = {
    connectFirstClientsOfRoom: function(wsServer, socket, otherSocketId, socketsDetails) {
        const randomstring = require('randomstring');
        const room = randomstring.generate();
        const serverAdapter = wsServer.of("/").adapter;
        integrateSocketToRoom(serverAdapter, socket.id, room); // We can use socket.join(room) too
        integrateSocketToRoom(serverAdapter, otherSocketId, room);

        socket.emit("private_chatbox", {
            emails: [socketsDetails[otherSocketId].email],
            room,
        });

        socket.to(room).emit("private_chatbox_opened", {
            email: socketsDetails[socket.id].email,
            room,
        });
        // We inform the others that people join the room

        socket.except(room).emit("private_chatbox_opened_by_others", {
            clients: [
                socketsDetails[socket.id].email,
                socketsDetails[otherSocketId].email,
            ],
            room, 
        });
    },
    connectClientAfterRoomIsCreated: function(wsServer, room, socket, socketsDetails) {
        const emails = [];
        wsServer.of("/").adapter.rooms.get(room).forEach((socketId) => {
            emails.push(socketsDetails[socketId].email);
        });

        socket.join(room);
        socket.emit("private_chatbox", {
            emails,
            room,
        });
        socket.to(room).emit("private_chatbox_joined", {
            email: socketsDetails[socket.id].email,
            room,
        });
        socket.except(room).emit("private_chatbox_opened_by_others", {
            clients: [socketsDetails[socket.id].email],
            room,
        });
    }
}
