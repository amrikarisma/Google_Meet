const { Socket } = require("engine.io");
const express = require("express");
const path = require("path");
var app = express();
var server = app.listen(process.env.PORT || 3000, function () {
    console.log("listening on port 3000");
});

const fs = require("fs");
const fileUpload = require("express-fileupload");
const io = require("socket.io")(server, {
    allowEIO3: true
});
app.use(express.static(path.join(__dirname, "")));

var userConnection = [];
io.on("connection", (socket) => {
    console.log("socket id is ", socket.id);
    socket.on("userconnect", (data) => {
        console.log("userconnect: ", data)
        var other_users = userConnection.filter((p) => p.meeting_id == data.meeting_id);

        userConnection.push({
            connectionId: socket.id,
            user_id: data.displayName,
            meeting_id: data.meeting_id
        })

        var userCount = userConnection.length;

        other_users.forEach((v) => {
            socket.to(v.connectionId).emit("inform_others_about_me", {
                other_user_id: data.displayName,
                connId: socket.id,
                userNumber: userCount
            });
        })
        socket.emit("inform_me_about_other_user", other_users);

    });
    socket.on("SDPProcess", (data) => {
        socket.to(data.to_connId).emit("SDPProcess", {
            message: data.message,
            from_connId: socket.id
        })
    })

    socket.on("sendMessage", (msg) => {
        console.log(msg);
        var mUser = userConnection.find((p) => p.connectionId == socket.id);
        if (mUser) {
            var meeting_id = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnection.filter((p) => p.meeting_id == meeting_id);
            list.forEach(v => {
                socket.to(v.connectionId).emit("showChatMessage", {
                    from: from,
                    message: msg
                })
            });
        }
    })
    socket.on("fileTransferToOthers", function (msg) {
        console.log(msg);
        var mUser = userConnection.find((p) => p.connectionId == socket.id);
        if (mUser) {
            var meeting_id = mUser.meeting_id;
            var list = userConnection.filter((p) => p.meeting_id == meeting_id);
            list.forEach(v => {
                socket.to(v.connectionId).emit("showFileMessage", {
                    username: msg.username,
                    meeting_id: msg.meeting_id,
                    fileName: msg.fileName,
                    filePath: msg.filePath
                })
            });
        }
    })
    socket.on("disconnect", function () {
        console.log("Disconnected");
        var disconnect_user = userConnection.find((p) => p.connectionId == socket.id);
        if (disconnect_user) {
            var meeting_id = disconnect_user.meeting_id;
            userConnection = userConnection.filter((p) => p.connectionId != socket.id);
            var list = userConnection.filter((p) => p.meeting_id == meeting_id);
            list.forEach((v) => {
                var userNumber = userConnection.length;
                socket.to(v.connectionId).emit("inform_other_about_disconnected_user", {
                    connId: socket.id,
                    userNumber: userNumber
                });
            })
        }
    })
})
app.use(fileUpload());
app.post("/attach", function (req, res) {
    var data = req.body;
    var file = req.files.file;
    console.log(file);
    var dir = `public/attachment/${data.meeting_id}/`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }

    file.mv(`${dir}${file.name}`, function (error) {
        if (error) {
            console.log("Couldn't upload the image file, error: ", error);
        } else {
            console.log("Image file successfully uploaded")
        }
    })
    return true;
});
