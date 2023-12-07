"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const storage_1 = require("@google-cloud/storage");
const multer_1 = __importDefault(require("multer"));
const { spawn } = require("child_process");
const app = (0, express_1.default)();
const port = 4000;
const src = path_1.default.join(__dirname, "views");
app.use(express_1.default.static(src));
const upload = (0, multer_1.default)({
  storage: multer_1.default.memoryStorage(),
});
const projectId = "eco-groove-405904";
const keyFilename = "mykey.json";
const storage = new storage_1.Storage({
  projectId,
  keyFilename,
});
const bucket = storage.bucket("varsh-storage");
app.get("/upload", (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      const [files] = yield bucket.getFiles({ prefix: "Low/" });
      const result = files.map((x) => {
        return x.metadata.name.split("/")[1];
      });
      return res.send(result);
    } catch (error) {
      res.send("Error:" + error);
    }
  })
);
app.get("/stream/:videoFileName", (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      const videoFileName = req.params.videoFileName;
      const file = bucket.file(videoFileName);
      const [metadata] = yield file.getMetadata();
      const fileSize =
        (metadata === null || metadata === void 0 ? void 0 : metadata.size) ||
        undefined;
      if (fileSize !== undefined) {
        res.setHeader("Content-Type", "video/mp4");
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunkSize = 10 ** 6; // 1 MB
          res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Content-Length", chunkSize);
          res.status(206);
          const readStream = file.createReadStream({ start, end });
          readStream.on("error", (err) => {
            res.status(500).send("Internal Server Error");
          });
          readStream.pipe(res);
        } else {
          res.status(400).send("Bad Request: Range header is missing");
        }
      } else {
        res.status(500).send("Internal Server Error: File size is undefined");
      }
    } catch (error) {
      res.status(500).send("Internal Server Error");
    }
  })
);
app.post("/upload", upload.single("video"), (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    console.log("Made it /upload");
    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded");
      }
      console.log("File found, trying to upload and compress");
      var resolutions = [
        { CRF: 40, audio: "20k", quality: "Low" },
        { CRF: 35, audio: "40k", quality: "Medium" },
        { CRF: 30, audio: "60k", quality: "High" },
      ];
      for (var i = 0; i < resolutions.length; i++) {
        const compressedFileName =
          resolutions[i].quality + "/" + `compressed_${req.file.originalname}`;
        const ffmpegProcess = spawn("C:/ffmpeg/bin/ffmpeg.exe", [
          "-i",
          "-", // stdin
          "-c:v",
          "libx264", // video codec
          "-crf",
          resolutions[i].CRF, // constant rate factor
          "-c:a",
          "aac",
          "-b:a",
          resolutions[i].audio, // audio codec
          "-f",
          "mp4", // mp4 format
          "-preset",
          "fast", // compression speed
          "-movflags",
          "frag_keyframe+empty_moov", // MOV flags for better streaming
          "pipe:1", // stdout
        ]);
        // Stream the input video buffer to the FFmpeg process
        ffmpegProcess.stdin.write(req.file.buffer);
        ffmpegProcess.stdin.end();
        // Creates a writable stream for the compressed video in GCS
        const compressedBlob = bucket.file(compressedFileName);
        const compressedBlobStream = compressedBlob.createWriteStream();
        // Pipe the output of ffmpeg to the GCS stream
        ffmpegProcess.stdout.pipe(compressedBlobStream);
        compressedBlobStream.on("error", (error) => {
          console.error("Error writing to Google Cloud Storage:", error);
          res.status(500).send("Internal Server Error");
          ffmpegProcess.kill();
        });
        compressedBlobStream.on("finish", () => {
          console.log("Success");
        });
      }
      res.status(200).send("Success");
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
    }
  })
);
app.get("/", (req, res) => {
  res.sendFile(path_1.default.join(src, "index.html"));
});
app.listen(port, () => {
  console.log(`Server is listening to port ${port}`);
});

// test