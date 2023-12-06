"use strict";
var _a;
(_a = document.getElementById("submitBtn")) === null || _a === void 0
  ? void 0
  : _a.addEventListener("click", () => {
      var _a;
      let inputElem = document.getElementById("videofile");
      let file =
        (_a = inputElem.files) === null || _a === void 0 ? void 0 : _a[0];
      if (file) {
        let blob = file.slice(0, file.size, "video/mp4");
        let newFile = new File([blob], `${Date.now()}_post.mp4`, {
          type: "video/mp4",
        });
        let formData = new FormData();
        formData.append("video", newFile);
        fetch("/upload", {
          method: "POST",
          body: formData,
        })
          .then((res) => res.text())
          .then(loadPosts);
      }
    });
function loadPosts() {
  fetch("/upload")
    .then((res) => res.json())
    .then((x) => {
      var videosContainer = document.getElementById("videos");

      for (let y = 0; y < x.length; y++) {
        const newVideo = document.createElement("video");
        newVideo.setAttribute("width", "500");
        newVideo.setAttribute("height", "300");
        newVideo.setAttribute("controls", "controls");
        newVideo.setAttribute(
          "src",
          "http://localhost:4000/stream/" + `Low%2F${x[y]}`
          // x[0][y].id
        );
        newVideo.classList.add("plyr");
        newVideo.classList.add("js-plyr");
        newVideo.style.padding = "10px 0px 0px 0px";
        videosContainer.appendChild(newVideo);
      }
      const players = Plyr.setup(".js-plyr", {
        quality: {
          default: 720,
          options: [240, 480, 720, 1080],
          forced: true,
          onChange: (quality) => {
            240;
          },
        },
      });
    });
}
