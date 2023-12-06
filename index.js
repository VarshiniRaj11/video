"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const storage_1 = require("@google-cloud/storage");
const multer_1 = __importDefault(require("multer"));
const { spawn } = require("child_process");
//ffmpeg.setFfmpegPath("C:/ffmpeg/bin/ffmpeg.exe");
const app = (0, express_1.default)();
const port = 4000;
const src = path_1.default.join(__dirname, "views");
app.use(express_1.default.static(src));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const projectId = "eco-groove-405904";
const keyFilename = "mykey.json";
const storage = new storage_1.Storage({
    projectId,
    keyFilename,
});
const bucket = storage.bucket("varsh-storage");
app.get("/upload", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [files] = yield bucket.getFiles({ prefix: "Low/" });
        const result = files.map((x) => {
            return x.metadata.name.split("/")[1];
        });
        return res.send(result);
    }
    catch (error) {
        res.send("Error:" + error);
    }
}));
app.get("/stream/:videoFileName", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const videoFileName = req.params.videoFileName;
        const file = bucket.file(videoFileName);
        // Get the file size
        const [metadata] = yield file.getMetadata();
        const fileSize = (metadata === null || metadata === void 0 ? void 0 : metadata.size) || undefined;
        if (fileSize !== undefined) {
            // Set the content type
            res.setHeader("Content-Type", "video/mp4");
            // Parse Range header to get the start and end bytes
            const range = req.headers.range;
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                // Calculate chunk size (you can adjust this value)
                const chunkSize = 10 ** 6; // 1 MB
                // Set the response headers for partial content
                res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
                res.setHeader("Accept-Ranges", "bytes");
                res.setHeader("Content-Length", chunkSize);
                res.status(206);
                // Stream the file in chunks
                const readStream = file.createReadStream({ start, end });
                readStream.on("error", (err) => {
                    // console.error("Error reading stream:", err);
                    res.status(500).send("Internal Server Error");
                });
                readStream.pipe(res);
            }
            else {
                // Handle the case when 'range' is undefined
                res.status(400).send("Bad Request: Range header is missing");
            }
        }
        else {
            // Handle the case when 'fileSize' is undefined
            res.status(500).send("Internal Server Error: File size is undefined");
        }
    }
    catch (error) {
        // console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
}));
app.post("/upload", upload.single("video"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Made it /upload");
    try {
        if (!req.file) {
            return res.status(400).send("No file uploaded");
        }
        console.log("File found, trying to upload and compress");
        var resolutions = [
            { a: 40, b: "20k", c: "Low" },
            { a: 35, b: "40k", c: "Medium" },
            { a: 30, b: "60k", c: "High" },
        ];
        for (var i = 0; i < resolutions.length; i++) {
            const compressedFileName = resolutions[i].c + "/" + `compressed_${req.file.originalname}`;
            // Compress the video using ffmpeg
            const ffmpegProcess = spawn("C:/ffmpeg/bin/ffmpeg.exe", [
                "-i",
                "-",
                "-c:v",
                "libx264",
                "-crf",
                resolutions[i].a,
                "-c:a",
                "aac",
                "-b:a",
                resolutions[i].b,
                "-f",
                "mp4",
                "-preset",
                "fast", // Adjust compression speed (optional)
                "-movflags",
                "frag_keyframe+empty_moov", // For better streaming support (optional)
                "pipe:1", // Output to stdout
            ]);
            // Stream the input video buffer to the FFmpeg process
            ffmpegProcess.stdin.write(req.file.buffer);
            ffmpegProcess.stdin.end();
            // Create a writable stream for the compressed video in Google Cloud Storage
            const compressedBlob = bucket.file(compressedFileName);
            const compressedBlobStream = compressedBlob.createWriteStream();
            // Pipe the output of ffmpeg to the Google Cloud Storage stream
            ffmpegProcess.stdout.pipe(compressedBlobStream);
            compressedBlobStream.on("error", (error) => {
                console.error("Error writing to Google Cloud Storage:", error);
                res.status(500).send("Internal Server Error");
                // Close the FFmpeg process if there's an error with the storage stream
                ffmpegProcess.kill();
            });
            compressedBlobStream.on("finish", () => {
                // res.status(200).send("Success");
                console.log("Success");
            });
        }
        res.status(200).send("Success");
    }
    catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
}));
app.get("/", (req, res) => {
    res.sendFile(path_1.default.join(src, "index.html"));
});
app.listen(port, () => {
    console.log(`Server is listening to port ${port}`);
});

// test